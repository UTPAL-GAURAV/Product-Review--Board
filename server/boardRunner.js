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

function makeEmitter(sessionId, round = 1) {
  return async (event) => {
    // Persist to DB
    if (event.type === "agent_message") {
      const agentId = await db.getAgentIdByRoleKey(event.agentKey);
      await db.insertMessage({
        session_id: sessionId,
        agent_id: agentId,
        role: "assistant",
        content: event.content,
        round_number: round,
        phase: event.phase,
      });
    } else if (event.type === "vote") {
      const agentId = await db.getAgentIdByRoleKey(event.agentKey);
      await db.insertVote({
        session_id: sessionId,
        agent_id: agentId,
        vote: event.vote,
        confidence: event.confidence,
        reasoning: event.reasoning,
      });
    }

    // Push to SSE client
    const client = sseClients && sseClients.get(sessionId);
    if (client) {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };
}

async function runSession(sessionId, productDescription) {
  const session = await db.getSession(sessionId);

  // Build initial context — prepend any enrichment the founder provided
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
    await db.updateSessionStatus(sessionId, "reviewing");
    const emit1 = makeEmitter(sessionId, 1);
    const p1 = await runPhase1(productDescription, history, emit1);
    for (const [key, response] of Object.entries(p1)) {
      history.push({ role: "assistant", content: `[${AGENTS[key].name} - Phase 1]: ${response}` });
    }

    await db.updateSessionStatus(sessionId, "debating");
    const emit2 = makeEmitter(sessionId, 2);
    const p2 = await runPhase2(history, p1, emit2);
    for (const [key, response] of Object.entries(p2)) {
      history.push({ role: "assistant", content: `[${AGENTS[key].name} - Debate]: ${response}` });
    }

    const emit3 = makeEmitter(sessionId, 3);
    const spec = await runPhase3(history, emit3);
    history.push({ role: "assistant", content: `[Product Manager - Revised Spec]: ${spec}` });
    await db.updateCurrentSpec(sessionId, spec);

    await db.updateSessionStatus(sessionId, "awaiting_founder");
    const client = sseClients && sseClients.get(sessionId);
    if (client) client.write(`data: ${JSON.stringify({ type: "status_change", status: "awaiting_founder" })}\n\n`);

    activeSessions.set(sessionId, { history, round: 3 });
  } catch (err) {
    const client = sseClients && sseClients.get(sessionId);
    if (client) client.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    throw err;
  }
}

async function handleFounderInput(sessionId, content) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { history } = session;
  const round = (session.round || 3) + 1;
  session.round = round;

  await db.insertMessage({
    session_id: sessionId,
    agent_id: null,
    role: "user",
    content: `[Founder Input]: ${content}`,
    round_number: round,
    phase: 4,
  });
  history.push({ role: "user", content: `[Founder Input]: ${content}` });

  const emit = makeEmitter(sessionId, round);
  await emit({ type: "phase_start", phase: 4, label: "PHASE 4: FOUNDER RESPONSE" });

  const founderPrompt = `The founder has responded: "${content}"\n\nIncorporate this into your thinking. React directly to the founder's input from your perspective.`;

  for (const agentKey of AGENT_ORDER) {
    const agent = AGENTS[agentKey];
    const response = await runAgent(agentKey, history, founderPrompt);
    history.push({ role: "assistant", content: `[${agent.name}]: ${response}` });
    await emit({ type: "agent_message", agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 4 });
  }
}

async function proceedToVote(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { history } = session;
  const emit5 = makeEmitter(sessionId, 5);
  const emit6 = makeEmitter(sessionId, 6);

  await db.updateSessionStatus(sessionId, "voting");
  const client = sseClients && sseClients.get(sessionId);
  if (client) client.write(`data: ${JSON.stringify({ type: "status_change", status: "voting" })}\n\n`);

  const finalSpec = await runPhase5(history, emit5);
  history.push({ role: "assistant", content: `[Product Manager - Final Spec]: ${finalSpec}` });
  await db.updateCurrentSpec(sessionId, finalSpec);

  const { voteResults } = await runPhase6(history, emit6);

  const emitFinal = makeEmitter(sessionId, 6);
  await runFinalOutput(history, voteResults, emitFinal);

  await db.updateSessionStatus(sessionId, "completed");
  if (client) client.write(`data: ${JSON.stringify({ type: "status_change", status: "completed" })}\n\n`);
}

module.exports = { runSession, handleFounderInput, proceedToVote, setSseClients };
