const {
  runPhase1,
  runPMSynthesis,
  runPhase2,
  runPhase5,
  runPhase6,
  runFinalOutput,
  runAgent,
  AGENT_ORDER,
  BOARD_MEMBERS,
} = require("../board");
const AGENTS = require("../agents");
const db = require("./db");

// In-memory session state (lost on restart, messages survive in DB)
const activeSessions = new Map();
const cancelledSessions = new Set();

function isCancelled(sessionId) {
  return cancelledSessions.has(sessionId);
}

function cancelSession(sessionId) {
  cancelledSessions.add(sessionId);
}

// SSE clients map — set by stream.js
let sseClients = null;
function setSseClients(map) {
  sseClients = map;
}

async function withRetry(fn, retries = 4, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isOverloaded = err.status === 529 || err.message?.includes('overloaded');
      const isRetryable = isOverloaded || err.status === 503 || err.status === 502;
      if (i === retries - 1 || !isRetryable) throw err;
      const wait = delayMs * Math.pow(2, i);
      console.log(`[retry] ${err.status || 'error'} — retrying in ${wait}ms (attempt ${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// Keep only the initial context + last N assistant turns to limit token growth
function trimHistory(history, keepLast = 6) {
  const first = history[0] // always keep initial product context
  const rest = history.slice(1)
  const trimmed = rest.slice(-keepLast)
  return [first, ...trimmed]
}

function pushSse(sessionId, event) {
  const client = sseClients && sseClients.get(sessionId);
  if (client) client.write(`data: ${JSON.stringify(event)}\n\n`);
}

function makeEmitter(sessionId, round = 1) {
  return async (event) => {
    if (event.type === "agent_message") {
      const agentId = await withRetry(() => db.getAgentIdByRoleKey(event.agentKey));
      await withRetry(() => db.insertMessage({
        session_id: sessionId,
        agent_id: agentId,
        role: "assistant",
        content: event.content,
        round_number: round,
        phase: event.phase,
      }));
    } else if (event.type === "vote") {
      const agentId = await withRetry(() => db.getAgentIdByRoleKey(event.agentKey));
      await withRetry(() => db.insertVote({
        session_id: sessionId,
        agent_id: agentId,
        vote: event.vote,
        confidence: event.confidence,
        reasoning: event.reasoning,
      }));
    }

    pushSse(sessionId, event);
  };
}

async function runSession(sessionId, productDescription) {
  const session = await withRetry(() => db.getSession(sessionId));

  const contextParts = [`Product idea to evaluate: "${productDescription}"`];
  if (session?.scraped_content) {
    contextParts.push(`The founder provided a reference URL. Scraped content:\n\n${session.scraped_content}`);
  }
  if (session?.visual_analysis) {
    contextParts.push(`The founder uploaded a screenshot. Visual analysis:\n\n${session.visual_analysis}`);
  }

  const history = [{ role: "user", content: contextParts.join("\n\n---\n\n") }];
  activeSessions.set(sessionId, { history, round: 1 });
  cancelledSessions.delete(sessionId);

  try {
    // Phase 1: Board reviews raw idea
    await withRetry(() => db.updateSessionStatus(sessionId, "reviewing"));
    const emit1 = makeEmitter(sessionId, 1);
    const p1 = await runPhase1(productDescription, trimHistory(history, 2), emit1);
    if (isCancelled(sessionId)) return;
    for (const [key, response] of Object.entries(p1)) {
      history.push({ role: "assistant", content: `[${AGENTS[key].name} - Phase 1]: ${response}` });
    }

    // PM Synthesis 1: curates Phase 1 insights, produces Spec v1
    await withRetry(() => db.updateSessionStatus(sessionId, "debating"));
    const emitS1 = makeEmitter(sessionId, 1);
    const specV1 = await runPMSynthesis(trimHistory(history, 8), 1, 1, emitS1);
    if (isCancelled(sessionId)) return;
    history.push({ role: "assistant", content: `[Product Manager - Spec v1]: ${specV1}` });
    await withRetry(() => db.updateCurrentSpec(sessionId, specV1));

    // Phase 2: Board debates Spec v1
    const emit2 = makeEmitter(sessionId, 2);
    const p2 = await runPhase2(trimHistory(history, 8), specV1, emit2);
    if (isCancelled(sessionId)) return;
    for (const [key, response] of Object.entries(p2)) {
      history.push({ role: "assistant", content: `[${AGENTS[key].name} - Debate]: ${response}` });
    }

    // PM Synthesis 2: addresses debate, produces Spec v2
    const emitS2 = makeEmitter(sessionId, 2);
    const specV2 = await runPMSynthesis(trimHistory(history, 10), 2, 2, emitS2);
    if (isCancelled(sessionId)) return;
    history.push({ role: "assistant", content: `[Product Manager - Spec v2]: ${specV2}` });
    await withRetry(() => db.updateCurrentSpec(sessionId, specV2));

    await withRetry(() => db.updateSessionStatus(sessionId, "awaiting_founder"));
    pushSse(sessionId, { type: "status_change", status: "awaiting_founder" });

    activeSessions.set(sessionId, { history, round: 3 });
  } catch (err) {
    pushSse(sessionId, { type: "error", message: err.message });
    throw err;
  }
}

async function handleFounderInput(sessionId, content) {
  let session = activeSessions.get(sessionId);
  if (!session) {
    console.log(`[session] ${sessionId} not in memory, rebuilding from DB...`);
    session = await rebuildSession(sessionId);
  }
  if (!session) return;

  const { history } = session;
  const round = (session.round || 3) + 1;
  session.round = round;

  await withRetry(() => db.insertMessage({
    session_id: sessionId,
    agent_id: null,
    role: "user",
    content: `[Founder Input]: ${content}`,
    round_number: round,
    phase: 4,
  }));
  history.push({ role: "user", content: `[Founder Input]: ${content}` });

  const emit = makeEmitter(sessionId, round);
  await emit({ type: "phase_start", phase: 4, label: "PHASE 4: FOUNDER RESPONSE" });

  // PM advocates on behalf of the founder first
  const pmAdvocatePrompt = `The founder has said: "${content}"\n\nAs Product Manager, your job is to:\n1. Interpret and strengthen the founder's position\n2. Answer any open questions from the board that the founder hasn't addressed\n3. Think through implications the founder may not have considered\n4. Present the founder's refined stance clearly\n\nSpeak as a thinking partner for the founder, not as a critic.`;

  pushSse(sessionId, { type: "thinking_start", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const pmResponse = await runAgent("pm", trimHistory(history, 8), pmAdvocatePrompt);
  pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });
  history.push({ role: "assistant", content: `[Product Manager - Founder Advocate]: ${pmResponse}` });
  await emit({ type: "agent_message", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: pmResponse, phase: 4 });

  // Board reacts to the PM's advocacy
  const boardPrompt = `The founder has responded and the PM has clarified their position. React from YOUR perspective only — one focused response, no summarizing others.`;

  for (const agentKey of BOARD_MEMBERS) {
    if (isCancelled(sessionId)) break;
    const agent = AGENTS[agentKey];
    pushSse(sessionId, { type: "thinking_start", agentKey, name: agent.name, emoji: agent.emoji });
    const response = await runAgent(agentKey, trimHistory(history, 8), boardPrompt);
    pushSse(sessionId, { type: "thinking_end", agentKey });
    history.push({ role: "assistant", content: `[${agent.name}]: ${response}` });
    await emit({ type: "agent_message", agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 4 });
  }
}

async function rebuildSession(sessionId) {
  const session = await withRetry(() => db.getSession(sessionId));
  if (!session) return null;

  const messages = await withRetry(() => db.listMessages(sessionId));
  const history = [{ role: "user", content: `Product idea to evaluate: "${session.product_description}"` }];
  for (const m of messages) {
    history.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
  }

  const rebuilt = { history, round: messages.length };
  activeSessions.set(sessionId, rebuilt);
  console.log(`[session] Rebuilt session ${sessionId} from DB (${messages.length} messages)`);
  return rebuilt;
}

async function improveIdea(sessionId, founderNote = "") {
  let session = activeSessions.get(sessionId);
  if (!session) {
    console.log(`[session] ${sessionId} not in memory, rebuilding from DB...`);
    session = await rebuildSession(sessionId);
  }
  if (!session) {
    console.error(`[session] Could not rebuild session ${sessionId}`);
    return;
  }

  const { history } = session;
  const round = (session.round || 3) + 1;
  session.round = round;

  const emit = makeEmitter(sessionId, round);
  await emit({ type: "phase_start", phase: 35, label: "PHASE 3.5: IDEA IMPROVEMENT — PM Synthesis" });

  const founderContext = founderNote
    ? `The founder has also added this note: "${founderNote}"\n\n`
    : "";

  const revisePrompt = `${founderContext}Based on all board discussion and founder input so far, produce an IMPROVED product proposal:\n1. **Preserve the core strengths** — identify what is genuinely working and keep it\n2. **Answer open questions** — address any unresolved questions the board raised\n3. **Address the biggest criticisms** — directly fix the weaknesses\n4. **Propose a new direction if needed** — pivot angle, audience, or model if fundamentally flawed\n5. **Present the improved idea** clearly as a proposal the board can continue discussing\n\nBe bold. Think on behalf of the founder where they haven't had answers.`;

  try {
    pushSse(sessionId, { type: "thinking_start", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
    const spec = await runAgent("pm", trimHistory(history, 10), revisePrompt);
    pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });
    history.push({ role: "assistant", content: `[Product Manager - Improved Idea]: ${spec}` });
    await emit({ type: "agent_message", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: spec, phase: 35 });
    await withRetry(() => db.updateCurrentSpec(sessionId, spec));
    await withRetry(() => db.updateSessionStatus(sessionId, "awaiting_founder"));
    pushSse(sessionId, { type: "status_change", status: "awaiting_founder" });
    activeSessions.set(sessionId, { ...session, history, round });
  } catch (err) {
    console.error("Improve idea error:", err.message);
    pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });
    pushSse(sessionId, { type: "error", message: err.message });
  }
}

async function proceedToVote(sessionId) {
  let session = activeSessions.get(sessionId);
  if (!session) {
    console.log(`[session] ${sessionId} not in memory, rebuilding from DB...`);
    session = await rebuildSession(sessionId);
  }
  if (!session) return;

  const { history } = session;
  const emit5 = makeEmitter(sessionId, 5);
  const emit6 = makeEmitter(sessionId, 6);

  await withRetry(() => db.updateSessionStatus(sessionId, "voting"));
  pushSse(sessionId, { type: "status_change", status: "voting" });

  pushSse(sessionId, { type: "thinking_start", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const finalSpec = await runPhase5(trimHistory(history, 10), emit5);
  pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });
  history.push({ role: "assistant", content: `[Product Manager - Final Spec]: ${finalSpec}` });
  await withRetry(() => db.updateCurrentSpec(sessionId, finalSpec));

  const { voteResults } = await runPhase6(trimHistory(history, 10), emit6);

  pushSse(sessionId, { type: "thinking_start", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const emitFinal = makeEmitter(sessionId, 6);
  await runFinalOutput(trimHistory(history, 10), voteResults, async (event) => {
    if (event.type === "final_output") {
      await withRetry(() => db.updateFinalOutput(sessionId, event.content));
    }
    await emitFinal(event);
  });
  pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });

  await withRetry(() => db.updateSessionStatus(sessionId, "completed"));
  pushSse(sessionId, { type: "status_change", status: "completed" });
}

async function createPlan(sessionId) {
  let session = activeSessions.get(sessionId);
  if (!session) {
    session = await rebuildSession(sessionId);
  }
  if (!session) {
    console.error(`[session] Could not rebuild session ${sessionId} for plan`);
    return;
  }

  const { history } = session;
  const dbSession = await withRetry(() => db.getSession(sessionId));

  pushSse(sessionId, { type: "plan_generating" });

  const planPrompt = `Based on the entire board discussion, votes, and final output, create a comprehensive Product Plan document optimized for handing off to an AI coding assistant (like Claude) to build the actual application.

Structure the plan EXACTLY as follows:

# Product Plan: [Product Name]

## What It Is
[2-3 sentence clear description of the product]

## What It Is NOT
[Bullet list of explicit scope exclusions — what will NOT be built]

## Core Features (MVP)
[Numbered list of exact features to build, each with a one-line description]

## Feature Details
[For each MVP feature: inputs, outputs, behavior, edge cases]

## Technical Stack (Recommended)
[Frontend, backend, database, auth, hosting — be specific]

## Data Models
[Key entities and their fields]

## User Flows
[Step-by-step flows for the 2-3 most important user journeys]

## Out of Scope (v1)
[Features explicitly deferred to later versions]

## Success Criteria
[How do we know the MVP is working?]

Be precise and unambiguous. Every decision should be made — no "TBD" or "decide later". This document will be fed directly to an AI to build the product.`;

  try {
    const plan = await runAgent("pm", trimHistory(history, 14), planPrompt);
    await withRetry(() => db.savePlan(sessionId, plan));
    pushSse(sessionId, { type: "plan_ready", content: plan });
    console.log(`[plan] Generated plan for session ${sessionId}`);
  } catch (err) {
    console.error(`[plan] Error generating plan: ${err.message}`);
    pushSse(sessionId, { type: "plan_error", message: err.message });
  }
}

module.exports = { runSession, handleFounderInput, improveIdea, proceedToVote, createPlan, cancelSession, setSseClients };
