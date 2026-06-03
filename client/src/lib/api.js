const BASE = '/api/sessions'

export async function listSessions() {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to load sessions')
  return res.json()
}

export async function createSession(product_name, product_description) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_name, product_description }),
  })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}

export async function getSession(id) {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}

export async function startSession(id) {
  const res = await fetch(`${BASE}/${id}/start`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to start session')
  return res.json()
}

export async function sendFounderInput(id, content) {
  const res = await fetch(`${BASE}/${id}/founder-input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('Failed to send founder input')
  return res.json()
}

export async function proceedToVote(id) {
  const res = await fetch(`${BASE}/${id}/proceed-to-vote`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to proceed to vote')
  return res.json()
}

export async function getMessages(id, since = null) {
  const url = since ? `${BASE}/${id}/messages?since=${encodeURIComponent(since)}` : `${BASE}/${id}/messages`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load messages')
  return res.json()
}

export async function getVotes(id) {
  const res = await fetch(`${BASE}/${id}/votes`)
  if (!res.ok) throw new Error('Failed to load votes')
  return res.json()
}

export async function scrapeUrl(url) {
  const res = await fetch('/api/enrich/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to scrape URL')
  }
  return res.json()
}

export async function analyzeImage(file, product_description = '') {
  const form = new FormData()
  form.append('screenshot', file)
  form.append('product_description', product_description)
  const res = await fetch('/api/enrich/analyze-image', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to analyze image')
  }
  return res.json()
}
