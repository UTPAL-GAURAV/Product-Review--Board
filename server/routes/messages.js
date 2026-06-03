const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:id/messages", async (req, res) => {
  try {
    const since = req.query.since || null;
    const messages = await db.listMessages(req.params.id, since);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/votes", async (req, res) => {
  try {
    const votes = await db.listVotes(req.params.id);
    res.json(votes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
