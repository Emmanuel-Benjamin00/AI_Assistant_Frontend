/** Base URL for the Django API. Empty in dev uses Vite proxy to 127.0.0.1:8000. */
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// Generous, so a cold-starting backend can still answer.
const REQUEST_TIMEOUT_MS = 90_000

function formatError(body, status) {
  if (status === 429) return 'Too many requests. Please wait a few minutes and try again.'
  if (body && typeof body === 'object') {
    const d = body.detail
    if (typeof d === 'string') return d
    // DRF validation errors: { field: ["message", ...] }
    const fields = d && typeof d === 'object' ? d : body
    const messages = Object.entries(fields)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ')
    if (messages) return messages
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

function networkError(err) {
  if (err.name === 'AbortError') {
    return new Error('The server took too long to respond. Please try again.', { cause: err })
  }
  return new Error('Could not reach the server. Check your connection and try again.', {
    cause: err,
  })
}

/** JSON bodies are encoded here; FormData (file uploads) is sent as multipart by the browser. */
async function send(path, { method = 'GET', body, headers = {}, signal }) {
  const isForm = body instanceof FormData
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body && !isForm ? JSON.stringify(body) : body,
    signal,
  })
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res
  try {
    res = await send(path, { ...options, signal: controller.signal })
  } catch (err) {
    throw networkError(err)
  } finally {
    clearTimeout(timer)
  }
  const data = await parseJson(res)
  if (!res.ok) throw new Error(formatError(data, res.status))
  return data
}

const ingestHeaders = (ingestKey) => (ingestKey ? { 'X-Ingest-Key': ingestKey } : {})

export function listDocuments() {
  return request('/api/documents/')
}

export function ingestDocument(title, text, ingestKey) {
  return request('/api/documents/', {
    method: 'POST',
    body: { title, text },
    headers: ingestHeaders(ingestKey),
  })
}

export function uploadDocument(file, title, ingestKey) {
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)
  return request('/api/documents/upload/', {
    method: 'POST',
    body: form,
    headers: ingestHeaders(ingestKey),
  })
}

export function askQuestion(question, { topK, mode, rerank }) {
  return request('/api/ask/', {
    method: 'POST',
    body: { question, top_k: topK, mode, rerank },
  })
}

export function askWithLangChain(question, { topK, mode, rerank }) {
  return request('/api/ask/langchain/', {
    method: 'POST',
    body: { question, top_k: topK, mode, rerank },
  })
}

export function askAgent(question) {
  return request('/api/agent/', { method: 'POST', body: { question } })
}

/** Split Server-Sent Events text into complete {event, data} messages plus the unfinished rest. */
export function parseSseChunk(buffer) {
  const events = []
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() // may be an incomplete event; keep it for the next chunk
  for (const block of blocks) {
    let event = 'message'
    const data = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    }
    if (data.length) events.push({ event, data: JSON.parse(data.join('\n')) })
  }
  return { events, rest }
}

/**
 * Stream an answer from /api/ask/stream/.
 *
 * EventSource only supports GET, so this reads the POST response body with fetch and parses
 * the Server-Sent Events by hand. Calls onSources once, then onToken for each piece of text.
 * The timeout resets whenever data arrives, so a long answer is never cut off mid-stream.
 */
export async function askQuestionStream(question, { topK, mode, rerank }, { onSources, onToken }) {
  const controller = new AbortController()
  let timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  }

  try {
    let res
    try {
      res = await send('/api/ask/stream/', {
        method: 'POST',
        body: { question, top_k: topK, mode, rerank },
        signal: controller.signal,
      })
    } catch (err) {
      throw networkError(err)
    }
    // Errors before streaming starts (validation, rate limit, provider down) are plain JSON.
    if (!res.ok) throw new Error(formatError(await parseJson(res), res.status))

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      let chunk
      try {
        chunk = await reader.read()
      } catch (err) {
        throw networkError(err)
      }
      if (chunk.done) break
      resetTimer()
      buffer += decoder.decode(chunk.value, { stream: true })
      const { events, rest } = parseSseChunk(buffer)
      buffer = rest
      for (const { event, data } of events) {
        if (event === 'sources') onSources(data.sources ?? [])
        else if (event === 'token') onToken(data.text)
        else if (event === 'error') throw new Error(data.detail || 'The answer was interrupted.')
        else if (event === 'done') return
      }
    }
    throw new Error('The answer was interrupted. Please try again.')
  } finally {
    clearTimeout(timer)
  }
}
