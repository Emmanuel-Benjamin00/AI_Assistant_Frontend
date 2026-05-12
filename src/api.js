/** Base URL for the Django API. Empty in dev uses Vite proxy to 127.0.0.1:8000. */
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

function formatError(body, status) {
  if (body && typeof body === 'object') {
    const d = body.detail
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      return Object.entries(d)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ')
    }
  }
  return `Request failed (${status})`
}

async function parseJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

export async function ingestDocument(title, text) {
  const res = await fetch(`${API_BASE}/api/documents/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text }),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(formatError(body, res.status))
  return body
}

export async function askQuestion(question, topK) {
  const res = await fetch(`${API_BASE}/api/ask/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, top_k: topK }),
  })
  const body = await parseJson(res)
  if (!res.ok) throw new Error(formatError(body, res.status))
  return body
}
