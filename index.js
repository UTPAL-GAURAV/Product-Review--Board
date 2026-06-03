#!/usr/bin/env node

const readline = require("readline");
const {
  runAgent,
  runPhase1,
  runPhase2,
  runPhase3,
  runPhase5,
  runPhase6,
  runFinalOutput,
  AGENT_ORDER,
} = require("./board");
const AGENTS = require("./agents");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function banner() {
  console.log("\n" + "█".repeat(70));
  console.log("█" + " ".repeat(68) + "█");
  console.log("█" + "   AI PRODUCT REVIEW BOARD".padEnd(68) + "█");
  console.log("█" + "   Maximize the probability of building a successful product".padEnd(68) + "█");
  console.log("█" + " ".repeat(68) + "█");
  console.log("█".repeat(70));
  console.log(`
Board Members:
  📋 Product Manager (Moderator)
  👤 Target Customer
  📈 Growth & Marketing Lead
  ⚙️  Technical Architect
  💰 Investor
  🎓 Domain Expert
  ⚔️  Competitor Representative
  💀 Red Team Agent
  🔍 Market Analyst

The board is honest. The board is harsh. The board wants you to succeed.
`);
}

async function founderIntervention(conversationHistory, phase) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 4: FOUNDER INTERVENTION");
  console.log("═".repeat(70));
  console.log(`
You are the founder. You may:
  • Answer questions from the board
  • Add constraints or requirements
  • Change direction
  • Reject suggestions
  • Type "skip" to skip founder input
  • Type "proceed to vote" to trigger voting
  • Type "next" to continue to the next phase
`);

  while (true) {
    const input = await ask("\n🧑 Founder: ");
    const trimmed = input.trim();

    if (!trimmed || trimmed.toLowerCase() === "skip" || trimmed.toLowerCase() === "next") {
      console.log("\n[Proceeding without founder input]");
      break;
    }

    if (trimmed.toLowerCase() === "proceed to vote") {
      return "VOTE";
    }

    conversationHistory.push({ role: "user", content: `[Founder Input]: ${trimmed}` });

    console.log("\n[Board responding to founder input...]\n");

    for (const agentKey of AGENT_ORDER) {
      const agent = AGENTS[agentKey];
      process.stdout.write(`${agent.emoji} ${agent.name}...\n`);
      const response = await runAgent(
        agentKey,
        conversationHistory,
        `The founder has responded: "${trimmed}"\n\nIncorporate this into your thinking. React directly to the founder's input from your perspective.`
      );
      console.log(response);
      console.log("\n" + "─".repeat(60));
      conversationHistory.push({
        role: "assistant",
        content: `[${agent.name}]: ${response}`,
      });
    }

    console.log("\nContinue responding (or type 'next' / 'proceed to vote'):");
  }

  return "CONTINUE";
}

async function additionalRounds(conversationHistory) {
  const answer = await ask(
    "\n🔄 Would you like another discussion round? (yes/no): "
  );
  if (answer.trim().toLowerCase() !== "yes") return false;

  console.log("\n[Starting additional discussion round...]\n");

  const topic = await ask("Topic to focus on (or press Enter for open discussion): ");
  const roundPrompt = topic.trim()
    ? `The founder has requested another discussion round focused on: "${topic}"\n\nEngage with this specific concern from your perspective.`
    : `Continue the discussion. Push deeper on unresolved issues. Has your position changed based on anything said so far?`;

  for (const agentKey of AGENT_ORDER) {
    const agent = AGENTS[agentKey];
    process.stdout.write(`\n${agent.emoji} ${agent.name}...\n`);
    const response = await runAgent(agentKey, conversationHistory, roundPrompt);
    console.log(response);
    console.log("\n" + "─".repeat(60));
    conversationHistory.push({
      role: "assistant",
      content: `[${agent.name}]: ${response}`,
    });
  }

  return true;
}

async function main() {
  banner();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ Error: ANTHROPIC_API_KEY environment variable is not set.");
    console.error("   Export it: export ANTHROPIC_API_KEY=your_key_here");
    process.exit(1);
  }

  const productIdea = await ask("📣 Describe your product idea:\n> ");

  if (!productIdea.trim()) {
    console.log("No product idea provided. Exiting.");
    rl.close();
    return;
  }

  const conversationHistory = [
    {
      role: "user",
      content: `Product idea to evaluate: "${productIdea}"`,
    },
  ];

  try {
    // Phase 1
    const phase1Responses = await runPhase1(productIdea, conversationHistory);
    for (const [key, response] of Object.entries(phase1Responses)) {
      conversationHistory.push({
        role: "assistant",
        content: `[${AGENTS[key].name} - Phase 1]: ${response}`,
      });
    }

    // Phase 2
    const phase2Responses = await runPhase2(conversationHistory, phase1Responses);
    for (const [key, response] of Object.entries(phase2Responses)) {
      conversationHistory.push({
        role: "assistant",
        content: `[${AGENTS[key].name} - Debate]: ${response}`,
      });
    }

    // Phase 3
    const phase3Spec = await runPhase3(conversationHistory);
    conversationHistory.push({
      role: "assistant",
      content: `[Product Manager - Revised Spec]: ${phase3Spec}`,
    });

    // Phase 4: Founder
    let voteTriggered = false;
    const founderResult = await founderIntervention(conversationHistory, 4);
    if (founderResult === "VOTE") {
      voteTriggered = true;
    }

    // Additional rounds
    if (!voteTriggered) {
      while (true) {
        const didRound = await additionalRounds(conversationHistory);
        if (!didRound) break;

        const again = await ask(
          "\nType 'proceed to vote' to vote, or press Enter to continue: "
        );
        if (again.trim().toLowerCase() === "proceed to vote") {
          voteTriggered = true;
          break;
        }
      }
    }

    // Phase 5
    const finalSpec = await runPhase5(conversationHistory);
    conversationHistory.push({
      role: "assistant",
      content: `[Product Manager - Final Spec]: ${finalSpec}`,
    });

    // Check if voting was already triggered, otherwise prompt
    if (!voteTriggered) {
      const votePrompt = await ask(
        '\nType "proceed to vote" to cast votes, or press Enter to skip: '
      );
      if (votePrompt.trim().toLowerCase() !== "proceed to vote") {
        console.log("\n[Session ended without voting. Final spec is above.]");
        rl.close();
        return;
      }
    }

    // Phase 6
    const { voteResults } = await runPhase6(conversationHistory);

    // Final Output
    await runFinalOutput(conversationHistory, voteResults);
  } catch (err) {
    if (err.status === 401) {
      console.error("\n❌ Authentication failed. Check your ANTHROPIC_API_KEY.");
    } else {
      console.error("\n❌ Error:", err.message || err);
    }
    process.exit(1);
  }

  rl.close();
}

main();
