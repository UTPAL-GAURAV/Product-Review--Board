require("dotenv").config();
const { Pool } = require("pg");
const AGENTS = require("../agents");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function seedAgents() {
  for (const [key, agent] of Object.entries(AGENTS)) {
    await query(
      `INSERT INTO agents (name, role, role_key, system_prompt)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name, system_prompt = EXCLUDED.system_prompt`,
      [agent.name, key, key, agent.systemPrompt]
    );
  }
}

async function createSession(product_name, product_description, { url, scraped_content, visual_analysis } = {}) {
  const result = await query(
    `INSERT INTO discussion_sessions (product_name, product_description, url, scraped_content, visual_analysis)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [product_name, product_description, url || null, scraped_content || null, visual_analysis || null]
  );
  return result.rows[0];
}

async function listSessions() {
  const result = await query(
    `SELECT id, product_name, product_description, status, created_at
     FROM discussion_sessions
     ORDER BY created_at DESC`,
    []
  );
  return result.rows;
}

async function getSession(id) {
  const result = await query(
    `SELECT * FROM discussion_sessions WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateSessionStatus(id, status) {
  await query(
    `UPDATE discussion_sessions SET status = $1 WHERE id = $2`,
    [status, id]
  );
}

async function updateProductDescription(id, product_description) {
  await query(
    `UPDATE discussion_sessions SET product_description = $1 WHERE id = $2`,
    [product_description, id]
  );
}

async function updateCurrentSpec(id, spec) {
  await query(
    `UPDATE discussion_sessions SET current_product_spec = $1 WHERE id = $2`,
    [spec, id]
  );
}

async function updateFinalOutput(id, content) {
  await query(
    `ALTER TABLE discussion_sessions ADD COLUMN IF NOT EXISTS final_output text`,
    []
  );
  await query(
    `UPDATE discussion_sessions SET final_output = $1 WHERE id = $2`,
    [content, id]
  );
}

async function getAgentIdByRoleKey(roleKey) {
  const result = await query(
    `SELECT id FROM agents WHERE role_key = $1 LIMIT 1`,
    [roleKey]
  );
  return result.rows[0]?.id || null;
}

async function insertMessage({ session_id, agent_id, role, content, round_number = 1, phase = 1 }) {
  const result = await query(
    `INSERT INTO messages (session_id, agent_id, role, content, round_number, phase)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [session_id, agent_id || null, role, content, round_number, phase]
  );
  return result.rows[0];
}

async function listMessages(session_id, since = null) {
  const params = [session_id];
  let sinceClause = "";
  if (since) {
    params.push(since);
    sinceClause = `AND m.created_at > $2`;
  }
  const result = await query(
    `SELECT m.*, a.name AS agent_name, a.role_key AS agent_key
     FROM messages m
     LEFT JOIN agents a ON m.agent_id = a.id
     WHERE m.session_id = $1 ${sinceClause}
     ORDER BY m.created_at ASC`,
    params
  );
  return result.rows;
}

async function insertVote({ session_id, agent_id, vote, confidence, reasoning }) {
  const result = await query(
    `INSERT INTO votes (session_id, agent_id, vote, confidence, reasoning)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [session_id, agent_id || null, vote, confidence || null, reasoning]
  );
  return result.rows[0];
}

async function listVotes(session_id) {
  const result = await query(
    `SELECT v.*, a.name AS agent_name, a.role_key AS agent_key
     FROM votes v
     LEFT JOIN agents a ON v.agent_id = a.id
     WHERE v.session_id = $1
     ORDER BY v.created_at ASC`,
    [session_id]
  );
  return result.rows;
}

async function savePlan(session_id, content) {
  await query(
    `CREATE TABLE IF NOT EXISTS product_plans (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       session_id uuid NOT NULL UNIQUE REFERENCES discussion_sessions(id) ON DELETE CASCADE,
       content text NOT NULL,
       created_at timestamptz DEFAULT now(),
       updated_at timestamptz DEFAULT now()
     )`,
    []
  );
  await query(
    `INSERT INTO product_plans (session_id, content)
     VALUES ($1, $2)
     ON CONFLICT (session_id) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [session_id, content]
  );
}

async function getPlan(session_id) {
  try {
    const result = await query(
      `SELECT content FROM product_plans WHERE session_id = $1 LIMIT 1`,
      [session_id]
    );
    return result.rows[0]?.content || null;
  } catch {
    return null;
  }
}

module.exports = {
  seedAgents,
  createSession,
  listSessions,
  getSession,
  updateSessionStatus,
  updateCurrentSpec,
  updateFinalOutput,
  updateProductDescription,
  getAgentIdByRoleKey,
  insertMessage,
  listMessages,
  insertVote,
  listVotes,
  savePlan,
  getPlan,
  query,
};
