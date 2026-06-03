require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { seedAgents } = require("./db");
const sessionsRouter = require("./routes/sessions");
const messagesRouter = require("./routes/messages");
const streamRouter = require("./routes/stream");
const enrichRouter = require("./routes/enrich");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", messagesRouter);
app.use("/api/sessions", streamRouter);
app.use("/api/enrich", enrichRouter);

// Serve built React client in production
const clientDist = path.join(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

seedAgents()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed agents:", err.message);
    process.exit(1);
  });
