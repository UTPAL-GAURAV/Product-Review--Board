# Product Review Board

An AI-powered product review system where 9 specialized agents independently analyze your startup idea, debate it, and cast a final vote on whether it should be built.

## Agents

| Agent | Role |
|---|---|
| 💼 PM | Moderates the session, owns and revises the product spec |
| 🎒 Customer | Represents the end user with brutal honesty |
| 📈 Marketing | Stress-tests acquisition, distribution, and retention |
| 🏗 Architect | Evaluates technical feasibility and build risk |
| 💰 Investor | Assesses market size, timing, and unit economics |
| 🎓 Domain Expert | Surfaces industry realities the founder is ignoring |
| ⚔ Competitor | Argues from the strongest incumbent's perspective |
| 🔴 Red Team | Sole job is to kill the idea — no silver linings |
| 🔍 Market Analyst | Delivers objective market intelligence and competitor mapping |

## How It Works

The session runs in 6 phases:

1. **Initial Review** — all 9 agents analyze the idea independently
2. **Debate** — agents challenge each other's assumptions
3. **Product Revision** — PM produces a revised spec based on the discussion
4. **Founder Intervention** — you respond, add constraints, or change direction
5. **Final Review** — PM locks the definitive spec for voting
6. **Voting** — each agent votes YES or NO with a confidence score and reasoning

## Stack

- **Backend** — Node.js, Express, Anthropic SDK (Claude Opus)
- **Frontend** — React 18, Vite, Tailwind CSS
- **Database** — Neon (PostgreSQL) — stores sessions, messages, and votes
- **Streaming** — Server-Sent Events (SSE) for real-time agent responses

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Neon](https://neon.tech) project with the schema below applied

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd product-review-board
npm install
cd client && npm install && cd ..
```

### 2. Configure environment

Copy `.env` and fill in your values:

```bash
cp .env .env.local
```

```env
ANTHROPIC_API_KEY=your_api_key_here
DATABASE_URL=postgresql://...your_neon_connection_string...
PORT=3001
```

### 3. Apply the database schema

Run the following SQL against your Neon database (via the Neon console or `psql`):

```sql
CREATE TABLE discussion_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name        TEXT NOT NULL,
  product_description TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'reviewing'
                        CHECK (status IN ('reviewing','debating','awaiting_founder','voting','completed')),
  current_product_spec TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  role_key      TEXT UNIQUE,
  system_prompt TEXT NOT NULL
);

CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES discussion_sessions(id) ON DELETE CASCADE,
  agent_id     UUID REFERENCES agents(id) ON DELETE SET NULL,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content      TEXT NOT NULL,
  round_number INT NOT NULL DEFAULT 1,
  phase        INT DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES discussion_sessions(id) ON DELETE CASCADE,
  agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  vote       TEXT NOT NULL CHECK (vote IN ('yes','no')),
  confidence INT CHECK (confidence BETWEEN 0 AND 100),
  reasoning  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_round   ON messages(session_id, round_number);
CREATE INDEX idx_votes_session    ON votes(session_id);
```

Agent rows are seeded automatically from `agents.js` on server start — no manual inserts needed.

## Running the Project

### Web app (recommended)

```bash
npm run dev
```

This starts both the Express server (port 3001) and the Vite dev server (port 5173) concurrently.

Open [http://localhost:5175](http://localhost:5175).

### CLI (original terminal interface)

```bash
npm start
```

The CLI runs the full 6-phase session interactively in your terminal. All existing CLI behavior is preserved.

### Production build

```bash
npm run build        # builds client/dist
npm run start:web    # serves the built client + API on port 3001
```

## Project Structure

```
product-review-board/
├── agents.js          # All agent definitions (name, emoji, system prompt)
├── board.js           # Phase orchestration logic
├── index.js           # CLI entry point
│
├── server/
│   ├── index.js       # Express app entry
│   ├── db.js          # Neon/pg query helpers + seedAgents()
│   ├── boardRunner.js # Adapts board.js phases to SSE + DB persistence
│   └── routes/
│       ├── sessions.js  # GET/POST /api/sessions
│       ├── messages.js  # GET /api/sessions/:id/messages|votes
│       └── stream.js    # SSE stream + start/founder-input/proceed-to-vote
│
└── client/
    └── src/
        ├── components/  # React UI components
        ├── hooks/        # useSSEStream
        └── lib/          # API fetch helpers, agent metadata
```

## Adding a New Agent

1. Add the agent definition to `agents.js` (name, emoji, systemPrompt)
2. Add its key to `AGENT_ORDER` in `board.js`
3. Add its emoji and color to `client/src/lib/agents.js`
4. Restart the server — it will be seeded into the DB automatically
