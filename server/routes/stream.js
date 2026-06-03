const express = require("express");
const router = express.Router();
const db = require("../db");
const boardRunner = require("../boardRunner");
// In-memory SSE clients: Map<sessionId, res>
const sseClients = new Map();
boardRunner.setSseClients(sseClients);

router.get("/:id/stream", async (req, res) => {
  const sessionId = req.params.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Send a heartbeat immediately
  res.write(": heartbeat\n\n");

  sseClients.set(sessionId, res);

  req.on("close", () => {
    sseClients.delete(sessionId);
  });
});

router.post("/:id/start", async (req, res) => {
  const sessionId = req.params.id;
  try {
    const session = await db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "reviewing") {
      return res.status(400).json({ error: "Session already started" });
    }
    // Fire and forget — SSE stream carries updates
    boardRunner.runSession(sessionId, session.product_description).catch((err) => {
      console.error("Board runner error:", err.message);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/founder-input", async (req, res) => {
  const sessionId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "content is required" });
  try {
    boardRunner.handleFounderInput(sessionId, content).catch((err) => {
      console.error("Founder input error:", err.message);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/proceed-to-vote", async (req, res) => {
  const sessionId = req.params.id;
  try {
    boardRunner.proceedToVote(sessionId).catch((err) => {
      console.error("Proceed to vote error:", err.message);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/improve-idea", async (req, res) => {
  const sessionId = req.params.id;
  const { note = "" } = req.body;
  try {
    boardRunner.improveIdea(sessionId, note).catch((err) => {
      console.error("Improve idea error:", err.message);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/create-plan", async (req, res) => {
  const sessionId = req.params.id;
  try {
    boardRunner.createPlan(sessionId).catch((err) => {
      console.error("Create plan error:", err.message);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/plan", async (req, res) => {
  try {
    const plan = await db.getPlan(req.params.id);
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/stop", async (req, res) => {
  const sessionId = req.params.id;
  try {
    boardRunner.cancelSession(sessionId);
    await db.updateSessionStatus(sessionId, "awaiting_founder");
    const sseClient = sseClients.get(sessionId);
    if (sseClient) {
      sseClient.write(`data: ${JSON.stringify({ type: "thinking_end", agentKey: null })}\n\n`);
      sseClient.write(`data: ${JSON.stringify({ type: "status_change", status: "awaiting_founder" })}\n\n`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
