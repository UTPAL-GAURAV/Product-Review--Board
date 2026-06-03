const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
  try {
    const sessions = await db.listSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { product_name, product_description, url, scraped_content, visual_analysis } = req.body;
  if (!product_name || !product_description) {
    return res.status(400).json({ error: "product_name and product_description are required" });
  }
  try {
    const session = await db.createSession(product_name, product_description, {
      url,
      scraped_content,
      visual_analysis,
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  const { product_description } = req.body;
  if (!product_description) return res.status(400).json({ error: "product_description is required" });
  try {
    await db.updateProductDescription(req.params.id, product_description);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
