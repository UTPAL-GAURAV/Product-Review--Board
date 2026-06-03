require("dotenv").config();
const express = require("express");
const multer = require("multer");
const Anthropic = require("@anthropic-ai/sdk");
const { parse } = require("node-html-parser");
const AGENTS = require("../../agents");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const client = new Anthropic();

// Scrape a URL and return cleaned readable text
router.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProductReviewBot/1.0)" },
    });
    clearTimeout(timeout);

    if (!response.ok) return res.status(400).json({ error: `Failed to fetch URL: ${response.status}` });

    const html = await response.text();
    const root = parse(html);

    // Remove noise elements
    for (const tag of ["script", "style", "nav", "footer", "header", "iframe", "noscript"]) {
      root.querySelectorAll(tag).forEach(el => el.remove());
    }

    const title = root.querySelector("title")?.text?.trim() || "";
    const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute("content") || "";

    // Extract main content text
    const bodyText = (root.querySelector("main") || root.querySelector("article") || root.querySelector("body"))
      ?.text
      ?.replace(/\s+/g, " ")
      ?.trim()
      ?.slice(0, 8000) || "";

    const scraped = [
      title && `Title: ${title}`,
      metaDesc && `Description: ${metaDesc}`,
      bodyText && `Content:\n${bodyText}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    res.json({ scraped_content: scraped });
  } catch (err) {
    if (err.name === "AbortError") return res.status(408).json({ error: "URL fetch timed out" });
    res.status(500).json({ error: err.message });
  }
});

// Analyze a screenshot using Claude vision
router.post("/analyze-image", upload.single("screenshot"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "screenshot file is required" });

  const { product_description = "" } = req.body;
  const imageBase64 = req.file.buffer.toString("base64");
  const mediaType = req.file.mimetype || "image/png";

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: AGENTS.visual.systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: product_description
                ? `The founder is building: "${product_description}"\n\nAnalyze this screenshot in that context.`
                : "Analyze this screenshot and provide strategic intelligence for the product review board.",
            },
          ],
        },
      ],
    });

    const analysis = response.content[0].text;
    res.json({ visual_analysis: analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
