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

module.exports = router;
