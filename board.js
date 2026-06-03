const Anthropic = require("@anthropic-ai/sdk");
const AGENTS = require("./agents");

const client = new Anthropic();

const AGENT_ORDER = ["pm", "customer", "investor", "expert", "competitor", "redteam"];
const BOARD_MEMBERS = AGENT_ORDER.filter(k => k !== "pm");
const PM_AGENTS = new Set(["pm"]);

async function runAgent(agentKey, conversationHistory, extraInstruction = "") {
  const agent = AGENTS[agentKey];
  const messages = [
    ...conversationHistory,
    ...(extraInstruction ? [{ role: "user", content: extraInstruction }] : []),
  ];

  const model = PM_AGENTS.has(agentKey) ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
  console.log(`[agent] ${agent.name} (${model}) starting...`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create(
        { model, max_tokens: PM_AGENTS.has(agentKey) ? 1024 : 600, system: agent.systemPrompt, messages },
        { timeout: 60000, maxRetries: 0 }
      );
      console.log(`[agent] ${agent.name} done`);
      return response.content[0].text;
    } catch (err) {
      const isOverloaded = err.status === 529 || err.message?.includes('overloaded');
      if (!isOverloaded || attempt === 2) {
        console.error(`[agent] ${agent.name} error: ${err.message}`);
        throw err;
      }
      const wait = 3000 * Math.pow(2, attempt);
      console.log(`[agent] ${agent.name} overloaded, retrying in ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// Phase 1: Each board member reviews the raw product idea independently
async function runPhase1(productIdea, conversationHistory, emit = null) {
  if (emit) await emit({ type: 'phase_start', phase: 1, label: 'PHASE 1: INITIAL REVIEW — Independent Analysis' });

  const prompt = `The founder has presented this product idea:\n\n"${productIdea}"\n\nGive your independent analysis:\n1. **Strengths** — what genuinely works\n2. **Weaknesses** — real problems\n3. **Critical Risks** — what could kill this\n4. **Key Questions** — what must be answered before this is viable\n\nBe direct. Do NOT seek consensus.`;

  const responses = {};
  for (const agentKey of BOARD_MEMBERS) {
    const agent = AGENTS[agentKey];
    if (emit) await emit({ type: 'thinking_start', agentKey, name: agent.name, emoji: agent.emoji });
    const response = await runAgent(agentKey, conversationHistory, prompt);
    if (emit) await emit({ type: 'thinking_end', agentKey });
    responses[agentKey] = response;
    if (emit) await emit({ type: 'agent_message', agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 1 });
  }
  return responses;
}

// PM Synthesis: after Phase 1, PM curates insights and produces Spec v1
async function runPMSynthesis(conversationHistory, phaseNumber, specVersion, emit = null) {
  const phaseLabel = `PHASE ${phaseNumber}.5: PM SYNTHESIS — Spec v${specVersion}`;
  if (emit) await emit({ type: 'phase_start', phase: phaseNumber + 0.5, label: phaseLabel });

  const prompt = `You have just received the board's analysis. Your job now is to act as a product shaper, not a note-taker.

1. **Extract only the signal** — identify the 3-5 most important insights from the board. Discard noise, weak arguments, and redundant points.
2. **Address the real issues** — for each critical problem raised, decide: can it be fixed by changing the product? If yes, change it. If not, acknowledge it as a known risk.
3. **Produce Product Spec v${specVersion}** — a refined version of the product that addresses the board's legitimate concerns while preserving its core strengths.

Format the spec clearly with: Problem, Target User, Solution, MVP Scope, What Changed (and why), Known Risks.

Be decisive. This spec will be what the board debates next.`;

  if (emit) await emit({ type: 'thinking_start', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const spec = await runAgent("pm", conversationHistory, prompt);
  if (emit) await emit({ type: 'thinking_end', agentKey: 'pm' });
  if (emit) await emit({ type: 'agent_message', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: spec, phase: phaseNumber + 0.5 });

  return spec;
}

// Phase 2: Board debates the refined spec (not the original idea)
async function runPhase2(conversationHistory, spec, emit = null) {
  if (emit) await emit({ type: 'phase_start', phase: 2, label: 'PHASE 2: DEBATE — Challenging the Refined Spec' });

  const prompt = `The PM has produced a refined product spec based on your initial feedback:\n\n"${spec.slice(0, 600)}..."\n\nNow attack it directly. What problems remain? What did the PM get wrong or miss? What new risks does the revised direction create? One focused response from your perspective only.`;

  const responses = {};
  for (const agentKey of BOARD_MEMBERS) {
    const agent = AGENTS[agentKey];
    if (emit) await emit({ type: 'thinking_start', agentKey, name: agent.name, emoji: agent.emoji });
    const response = await runAgent(agentKey, conversationHistory, prompt);
    if (emit) await emit({ type: 'thinking_end', agentKey });
    responses[agentKey] = response;
    if (emit) await emit({ type: 'agent_message', agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 2 });
  }
  return responses;
}

// Phase 5: PM produces final spec for voting
async function runPhase5(conversationHistory, emit = null) {
  if (emit) await emit({ type: 'phase_start', phase: 5, label: 'PHASE 5: FINAL SPEC — Ready for Vote' });

  const prompt = `Produce the FINAL Product Specification — the definitive version the board will vote on. This should reflect everything: initial reviews, debate, PM refinements, and founder input.\n\nInclude:\n- Core Problem\n- Target User\n- Solution & MVP Scope\n- What This Is NOT\n- Go-to-Market\n- Competitive Advantage\n- Revenue Model\n- Remaining Risks\n\nThis is the board's last chance to shape the product before voting. Make it definitive.`;

  if (emit) await emit({ type: 'thinking_start', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const spec = await runAgent("pm", conversationHistory, prompt);
  if (emit) await emit({ type: 'thinking_end', agentKey: 'pm' });
  if (emit) await emit({ type: 'agent_message', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: spec, phase: 5 });

  return spec;
}

const VOTE_PROMPTS = {
  customer: `You are voting as the Target Customer. Your YES means: "I would genuinely pay for this and use it regularly — it solves a real problem I have." Your NO means: "I wouldn't pay for this or I'd churn quickly."\n\n`,
  investor: `You are voting as the Investor. Your YES means: "I would fund this — the market is large enough, timing is right, and the team has a credible path to returns." Your NO means: "I wouldn't write a check — the risk/reward doesn't work."\n\n`,
  expert: `You are voting as the Domain Expert. Your YES means: "This can actually work in this industry — the approach is sound and the barriers are manageable." Your NO means: "There are industry realities that make this unviable or extremely unlikely to succeed."\n\n`,
  competitor: `You are voting as the Competitor. Your YES means: "I cannot easily kill this — it has a real moat and I'd genuinely be threatened by it." Your NO means: "I could copy this tomorrow or my existing advantages would crush it."\n\n`,
  redteam: `You are voting as the Red Team. Your YES means: "I tried to kill this idea and couldn't find a fatal flaw — despite my best efforts, it survives scrutiny." Your NO means: "I found at least one fatal flaw that the team has not addressed."\n\n`,
};

// Phase 6: Each board member votes on the final spec
async function runPhase6(conversationHistory, emit = null) {
  if (emit) await emit({ type: 'phase_start', phase: 6, label: 'PHASE 6: VOTING — Is this worth building?' });

  const basePrompt = `You have reviewed, debated, and helped refine this product through multiple rounds. Now vote on the FINAL spec.\n\nProvide:\n1. **What my YES/NO means** (one sentence specific to your role)\n2. **Final Reasoning** (2-3 sentences — has the product improved enough?)\n3. **Biggest Remaining Concern**\n4. **Confidence Score** (0-100)\n5. **VOTE: YES (Build) or NO (Do Not Build)**\n\nYour vote is final and independent.`;

  const votes = {};
  const voteResults = { yes: 0, no: 0 };

  for (const agentKey of BOARD_MEMBERS) {
    const agent = AGENTS[agentKey];
    const rolePrompt = (VOTE_PROMPTS[agentKey] || '') + basePrompt;
    if (emit) await emit({ type: 'thinking_start', agentKey, name: agent.name, emoji: agent.emoji });
    const response = await runAgent(agentKey, conversationHistory, rolePrompt);
    if (emit) await emit({ type: 'thinking_end', agentKey });
    votes[agentKey] = response;

    const upper = response.toUpperCase();
    const yesMatch = upper.match(/\bVOTE[:\s]*YES\b|\bYES\b.*\bBUILD\b/);
    const noMatch = upper.match(/\bVOTE[:\s]*NO\b|\bNO\b.*\bDO NOT BUILD\b|\bDO NOT BUILD\b/);
    let vote;
    if (yesMatch && !noMatch) { vote = 'yes'; voteResults.yes++; }
    else if (noMatch) { vote = 'no'; voteResults.no++; }
    else if (upper.includes("YES")) { vote = 'yes'; voteResults.yes++; }
    else { vote = 'no'; voteResults.no++; }

    const confidenceMatch = response.match(/\b(\d{1,3})\s*(?:\/\s*100|%)/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : null;

    if (emit) await emit({ type: 'vote', agentKey, name: agent.name, emoji: agent.emoji, vote, confidence, reasoning: response });
  }

  return { votes, voteResults };
}

async function runFinalOutput(conversationHistory, voteResults, emit = null) {
  const total = voteResults.yes + voteResults.no;
  const approvalRate = Math.round((voteResults.yes / total) * 100);

  const prompt = `The board has voted on the refined product. YES: ${voteResults.yes}, NO: ${voteResults.no} (${approvalRate}% approval).\n\nProvide the final board output:\n1. **Build Recommendation** (clear verdict)\n2. **How the Product Evolved** (what changed from original idea to final spec)\n3. **Top 3 Remaining Risks**\n4. **Top 3 Opportunities**\n5. **MVP Scope** (exact first version)\n6. **First 30-Day Plan** (specific actions)\n\nThis is the board's final word.`;

  if (emit) await emit({ type: 'thinking_start', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji });
  const output = await runAgent("pm", conversationHistory, prompt);
  if (emit) await emit({ type: 'thinking_end', agentKey: 'pm' });
  if (emit) await emit({ type: 'final_output', content: output, voteResults });
}

module.exports = {
  runAgent,
  runPhase1,
  runPMSynthesis,
  runPhase2,
  runPhase5,
  runPhase6,
  runFinalOutput,
  AGENT_ORDER,
  BOARD_MEMBERS,
};
