# Product Review Board

An AI-powered product review system where specialized agents review, debate, and iteratively **shape** your startup idea into a refined product spec — then vote on whether it's worth building.

The key insight: this is not just a debate tool. After every phase, the PM synthesizes the board's feedback and produces an updated product spec. Each round of debate attacks the *latest version* of the idea, not the original. By the time voting happens, the product has been meaningfully refined.

## Agents

| Agent | Role |
|---|---|
| 📋 PM | Synthesizes feedback, shapes the product spec after every phase, advocates for the founder |
| 🎯 Target Customer | Represents the end user with brutal honesty |
| 💰 Investor | Assesses market size, timing, and unit economics |
| 🎓 Domain Expert | Surfaces industry realities the founder is ignoring |
| ⚔️ Competitor | Argues from the strongest incumbent's perspective |
| 💀 Red Team | Sole job is to kill the idea — no silver linings |

## How It Works

```
Phase 1: Board reviews raw idea (independently)
    ↓
PM Synthesis: Extracts signal, discards noise → Spec v1
    ↓
Phase 2: Board debates Spec v1 (not the original idea)
    ↓
PM Synthesis: Addresses debate, refines → Spec v2
    ↓
Founder Input (optional, repeatable):
  → PM advocates on founder's behalf
  → Board reacts
  → "Improve Idea" button: PM synthesizes + optional founder note → updated spec
    ↓
Proceed to Vote:
  → PM produces Final Spec
  → Each agent votes YES/NO with confidence score
  → PM delivers final board output
    ↓
Create Product Plan:
  → PM generates a detailed build plan (features, stack, data models, user flows)
  → Ready to paste into Claude or any AI coding assistant
```

**Voting answers:** "After all this refinement, is this product still worth building?"

## Stack

- **Backend** — Node.js, Express, Anthropic SDK
- **Models** — Claude Sonnet 4.6 (PM), Claude Haiku 4.5 (board agents)
- **Frontend** — React 18, Vite, Tailwind CSS
- **Database** — Neon (PostgreSQL)
- **Streaming** — Server-Sent Events (SSE)

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

```env
ANTHROPIC_API_KEY=your_api_key_here
DATABASE_URL=postgresql://...your_neon_connection_string...
PORT=3001
```

### 3. Apply the database schema

```sql
CREATE TABLE discussion_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name        TEXT NOT NULL,
  product_description TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'reviewing'
                        CHECK (status IN ('reviewing','debating','awaiting_founder','voting','completed')),
  current_product_spec TEXT,
  final_output        TEXT,
  url                 TEXT,
  scraped_content     TEXT,
  visual_analysis     TEXT,
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
  phase        FLOAT DEFAULT 1,
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

CREATE TABLE product_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES discussion_sessions(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_votes_session    ON votes(session_id);
```

Agent rows are seeded automatically from `agents.js` on server start.

## Running

```bash
npm run dev
```

Starts Express (port 3001) + Vite (port 5173) concurrently. Open [http://localhost:5175](http://localhost:5175).

## Project Structure

```
product-review-board/
├── agents.js          # Agent definitions (name, emoji, system prompt)
├── board.js           # Phase logic (runPhase1, runPMSynthesis, runPhase2, etc.)
│
├── server/
│   ├── index.js       # Express entry
│   ├── db.js          # Neon/pg helpers
│   ├── boardRunner.js # Orchestrates phases, persists to DB, pushes SSE
│   └── routes/
│       ├── sessions.js
│       ├── messages.js
│       └── stream.js  # SSE + start/founder-input/improve-idea/proceed-to-vote/create-plan/stop
│
└── client/src/
    ├── components/    # BoardRoom, AgentCard, ThinkingCard, FinalOutput, etc.
    ├── hooks/         # useSSEStream (live events + history reload)
    └── lib/           # api.js, agents.js metadata
```

## Cost per Session (approximate)

| Config | Cost |
|---|---|
| All Sonnet | ~$0.40–0.50 |
| All Haiku | ~$0.04–0.06 |
| Mixed (current: Haiku agents + Sonnet PM) | ~$0.08–0.15 |
