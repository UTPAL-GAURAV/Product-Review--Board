const Anthropic = require("@anthropic-ai/sdk");
const AGENTS = require("./agents");

const client = new Anthropic();

const AGENT_ORDER = ["pm", "customer", "growth", "architect", "investor", "expert", "competitor", "redteam", "market"];

async function runAgent(agentKey, conversationHistory, extraInstruction = "") {
  const agent = AGENTS[agentKey];
  const messages = [
    ...conversationHistory,
    ...(extraInstruction
      ? [{ role: "user", content: extraInstruction }]
      : []),
  ];

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: agent.systemPrompt,
    messages,
  });

  return response.content[0].text;
}

async function runPhase1(productIdea, conversationHistory, emit = null) {
  if (emit) {
    await emit({ type: 'phase_start', phase: 1, label: 'PHASE 1: INITIAL REVIEW — Independent Analysis' });
  } else {
    console.log("\n" + "═".repeat(70));
    console.log("  PHASE 1: INITIAL REVIEW — Independent Analysis");
    console.log("═".repeat(70));
  }

  const prompt = `The founder has presented this product idea for review:\n\n"${productIdea}"\n\nProvide your independent analysis with:\n1. **Strengths** (what actually works)\n2. **Weaknesses** (honest problems)\n3. **Critical Risks** (what could kill this)\n4. **Suggestions** (specific improvements)\n\nDo NOT look for consensus. Give your real, unfiltered opinion.`;

  const responses = {};

  for (const agentKey of AGENT_ORDER) {
    const agent = AGENTS[agentKey];
    if (!emit) process.stdout.write(`\n${agent.emoji} ${agent.name}...\n`);
    const response = await runAgent(agentKey, conversationHistory, prompt);
    responses[agentKey] = response;
    if (emit) {
      await emit({ type: 'agent_message', agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 1 });
    } else {
      console.log(response);
      console.log("\n" + "─".repeat(60));
    }
  }

  return responses;
}

async function runPhase2(conversationHistory, phase1Responses, emit = null) {
  if (emit) {
    await emit({ type: 'phase_start', phase: 2, label: 'PHASE 2: DEBATE — Challenging Assumptions' });
  } else {
    console.log("\n" + "═".repeat(70));
    console.log("  PHASE 2: DEBATE — Challenging Assumptions");
    console.log("═".repeat(70));
  }

  const summaries = AGENT_ORDER.map(
    (k) => `${AGENTS[k].name}: "${phase1Responses[k].slice(0, 300)}..."`
  ).join("\n\n");

  const debatePrompt = `The board has given initial reviews. Here is a summary of positions:\n\n${summaries}\n\nNow engage in direct debate. Challenge the other board members' assumptions. Identify the most important disagreements. Push back where you think someone is wrong.`;

  const responses = {};
  for (const agentKey of AGENT_ORDER) {
    const agent = AGENTS[agentKey];
    if (!emit) process.stdout.write(`\n${agent.emoji} ${agent.name} (debate)...\n`);
    const response = await runAgent(agentKey, conversationHistory, debatePrompt);
    responses[agentKey] = response;
    if (emit) {
      await emit({ type: 'agent_message', agentKey, name: agent.name, emoji: agent.emoji, content: response, phase: 2 });
    } else {
      console.log(response);
      console.log("\n" + "─".repeat(60));
    }
  }

  return responses;
}

async function runPhase3(conversationHistory, emit = null) {
  if (emit) {
    await emit({ type: 'phase_start', phase: 3, label: 'PHASE 3: PRODUCT REVISION' });
  } else {
    console.log("\n" + "═".repeat(70));
    console.log("  PHASE 3: PRODUCT REVISION");
    console.log("═".repeat(70));
  }

  const revisePrompt = `Based on all the discussion so far, present the REVISED Product Specification. This should incorporate the most important feedback from all board members. Be honest about what changed and why. Format it clearly with all sections.`;

  if (!emit) process.stdout.write(`\n${AGENTS.pm.emoji} ${AGENTS.pm.name} (revision)...\n`);
  const spec = await runAgent("pm", conversationHistory, revisePrompt);
  if (emit) {
    await emit({ type: 'agent_message', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: spec, phase: 3 });
  } else {
    console.log(spec);
  }

  return spec;
}

async function runPhase5(conversationHistory, emit = null) {
  if (emit) {
    await emit({ type: 'phase_start', phase: 5, label: 'PHASE 5: FINAL REVIEW' });
  } else {
    console.log("\n" + "═".repeat(70));
    console.log("  PHASE 5: FINAL REVIEW");
    console.log("═".repeat(70));
  }

  const finalPrompt = `Present the FINAL Product Specification after all discussion and founder input. Include:\n- Core Problem\n- Target User\n- MVP\n- Go-to-Market Strategy\n- Competitive Advantage\n- Revenue Model\n- Major Risks\n\nMake this the definitive version the board will vote on.`;

  if (!emit) process.stdout.write(`\n${AGENTS.pm.emoji} ${AGENTS.pm.name} (final spec)...\n`);
  const spec = await runAgent("pm", conversationHistory, finalPrompt);
  if (emit) {
    await emit({ type: 'agent_message', agentKey: 'pm', name: AGENTS.pm.name, emoji: AGENTS.pm.emoji, content: spec, phase: 5 });
  } else {
    console.log(spec);
  }

  return spec;
}

async function runPhase6(conversationHistory, emit = null) {
  if (emit) {
    await emit({ type: 'phase_start', phase: 6, label: 'PHASE 6: VOTING' });
  } else {
    console.log("\n" + "═".repeat(70));
    console.log("  PHASE 6: VOTING");
    console.log("═".repeat(70));
  }

  const votePrompt = `It's time to vote on whether to build this product. You MUST provide:\n1. **Final Reasoning** (2-3 sentences)\n2. **Biggest Concern** (one specific thing)\n3. **Confidence Score** (0-100)\n4. **VOTE: YES (Build) or NO (Do Not Build)**\n\nYour vote is final and independent. Do not try to align with others.`;

  const votes = {};
  const voteResults = { yes: 0, no: 0 };

  for (const agentKey of AGENT_ORDER) {
    const agent = AGENTS[agentKey];
    if (!emit) process.stdout.write(`\n${agent.emoji} ${agent.name} voting...\n`);
    const response = await runAgent(agentKey, conversationHistory, votePrompt);
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

    if (emit) {
      await emit({ type: 'vote', agentKey, name: agent.name, emoji: agent.emoji, vote, confidence, reasoning: response });
    } else {
      console.log(response);
      console.log("\n" + "─".repeat(60));
    }
  }

  return { votes, voteResults };
}

async function runFinalOutput(conversationHistory, voteResults, emit = null) {
  const total = voteResults.yes + voteResults.no;
  const approvalRate = Math.round((voteResults.yes / total) * 100);

  if (!emit) {
    console.log("\n" + "═".repeat(70));
    console.log("  VOTE RESULTS");
    console.log("═".repeat(70));
    console.log(`\n✅ YES Votes: ${voteResults.yes}`);
    console.log(`❌ NO Votes: ${voteResults.no}`);
    console.log(`📊 Approval Rate: ${approvalRate}%\n`);
  }

  const outputPrompt = `The board has voted. YES: ${voteResults.yes}, NO: ${voteResults.no} (${approvalRate}% approval).\n\nProvide the final output:\n1. **Build Recommendation** (based on vote and discussion)\n2. **Top 3 Risks**\n3. **Top 3 Opportunities**\n4. **MVP Recommendation** (exact scope for first version)\n5. **First 30-Day Execution Plan** (specific, actionable steps)\n\nBe direct. This is the board's final word.`;

  if (!emit) process.stdout.write(`\n${AGENTS.pm.emoji} Final Board Output...\n`);
  const output = await runAgent("pm", conversationHistory, outputPrompt);
  if (emit) {
    await emit({ type: 'final_output', content: output, voteResults });
  } else {
    console.log(output);
  }
}

module.exports = {
  runAgent,
  runPhase1,
  runPhase2,
  runPhase3,
  runPhase5,
  runPhase6,
  runFinalOutput,
  AGENT_ORDER,
};
