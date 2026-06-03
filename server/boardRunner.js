const {
  runPhase1,
  runPhase2,
  runPhase3,
  runPhase5,
  runPhase6,
  runFinalOutput,
  runAgent,
  AGENT_ORDER,
} = require("../board");
const AGENTS = require("../agents");
const db = require("./db");

// In-memory session state (lost on restart, messages survive in DB)
const activeSessions = new Map();

// SSE clients map — set by stream.js
let sseClients = null;
function setSseClients(map) {
  sseClients = map;
}

async function withRetry(fn, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
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
    contextParts.push(
      `The founder provided a reference URL. Here is the scraped content from that page:\n\n${session.scraped_content}`
    );
  }
  if (session?.visual_analysis) {
    contextParts.push(
      `The founder uploaded a screenshot. Here is the Visual Analyst's assessment of that image:\n\n${session.visual_analysis}`
    );
  }

  const history = [{ role: "user", content: contextParts.join("\n\n---\n\n") }];
  activeSessions.set(sessionId, { history, round: 1 });

  try {
    await withRetry(() => db.updateSessionStatus(sessionId, "reviewing"));
    const emit1 = makeEmitter(sessionId, 1);
    const p1 = await runPhase1(productDescription, history, emit1);
    for (const [key, response] of Object.entries(p1)) {
      history.push({ role: "assistant", content: `[${AGENTS[key].name} - Phase 1]: ${response}` });
    }

    await withRetry(() => db.updateSessionStatus(sessionId, "debating"));
    const emit2 = makeEmitter(sessionId, 2);
    const p2 = await runPhase2(history, p1, emit2);
    for (const [key, response] of Object.entries(p2)) {
      history.push({ role: "assistant", content: `[${AGENTS[key].name} - Debate]: ${response}` });
    }

    const emit3 = makeEmitter(sessionId, 3);
    const spec = await runPhase3(history, emit3);
    history.push({ role: "assistant", content: `[Product Manager - Revised Spec]: ${spec}` });
    await withRetry(() => db.updateCurrentSpec(sessionId, spec));

    await withRetry(() => db.updateSessionStatus(sessionId, "awaiting_founder"));
    pushSse(sessionId, { type: "status_change", status: "awaiting_founder" });

    activeSessions.set(sessionId, { history, round: 3 });
  } catch (err) {
    pushSse(sessionId, { type: "error", message: err.message });
    throw err;
  }
}

async function handleFounderInput(sessionId, content) {
  const session = activeSessions.get(sessionId);
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

  const founderPrompt = `The founder has responded: "${content}"\n\nIncorporate this into your thinking. React directly to the founder's input from your perspective.`;

  for (const agentKey of AGENT_ORDER) {
    const agent = AGENTS[agentKey];
    pushSse(sessionId, { type: "thinking_start", agentKey, name: agent.name, emoji: agent.emoji });
    const response = await runAgent(agentKey, history, founderPrompt);
    pushSse(sessionId, { type: "thinking_end", agentKey });
    history.push({ role: "assistant", content: `[${agent.name}]: ${response}` });
    await emit({ type: "agent_message", agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 4 });
  }
}

async function improveIdea(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { history } = session;
  const round = (session.round || 3) + 1;
  session.round = round;

  const emit = makeEmitter(sessionId, round);
  await emit({ type: "phase_start", phase: 35, label: "PHASE 3.5: IDEA IMPROVEMENT — PM Synthesis" });

  pushSse(sessionId, { type: "thinking_start", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const revisePrompt = `Based on all board discussion and founder input so far, synthesize an IMPROVED product idea. Incorporate the strongest feedback, address the biggest criticisms, and highlight the best opportunities. Present this as a revised proposal the board can continue discussing.`;
  const spec = await runAgent("pm", history, revisePrompt);
  pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });

  history.push({ role: "assistant", content: `[Product Manager - Improved Idea]: ${spec}` });
  await emit({ type: "agent_message", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: spec, phase: 35 });
  await withRetry(() => db.updateCurrentSpec(sessionId, spec));

  await withRetry(() => db.updateSessionStatus(sessionId, "awaiting_founder"));
  pushSse(sessionId, { type: "status_change", status: "awaiting_founder" });

  activeSessions.set(sessionId, { ...session, history, round });
}

async function proceedToVote(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { history } = session;
  const emit5 = makeEmitter(sessionId, 5);
  const emit6 = makeEmitter(sessionId, 6);

  await withRetry(() => db.updateSessionStatus(sessionId, "voting"));
  pushSse(sessionId, { type: "status_change", status: "voting" });

  pushSse(sessionId, { type: "thinking_start", agentKey: "pm", name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const finalSpec = await runPhase5(history, emit5);
  pushSse(sessionId, { type: "thinking_end", agentKey: "pm" });
  history.push({ role: "assistant", content: `[Product Manager - Final Spec]: ${finalSpec}` });
  await withRetry(() => db.updateCurrentSpec(sessionId, finalSpec));

  const { voteResults } = await runPhase6(history, emit6);

  const emitFinal = makeEmitter(sessionId, 6);
  await runFinalOutput(history, voteResults, emitFinal);

  await withRetry(() => db.updateSessionStatus(sessionId, "completed"));
  pushSse(sessionId, { type: "status_change", status: "completed" });
}

module.exports = { runSession, handleFounderInput, improveIdea, proceedToVote, setSseClients };
