import { useState } from 'react'
import { askQuestion, ingestDocument } from './api'
import './App.css'

function App() {
  const [title, setTitle] = useState('')
  const [docText, setDocText] = useState('')
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestMessage, setIngestMessage] = useState(null)
  const [ingestError, setIngestError] = useState(null)

  const [question, setQuestion] = useState('')
  const [topK, setTopK] = useState(5)
  const [askLoading, setAskLoading] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [sources, setSources] = useState([])
  const [askError, setAskError] = useState(null)

  async function handleIngest(e) {
    e.preventDefault()
    setIngestError(null)
    setIngestMessage(null)
    setIngestLoading(true)
    try {
      const r = await ingestDocument(title.trim(), docText)
      setIngestMessage(
        `Ingested document #${r.document_id} (${r.chunks_created} chunks).`,
      )
      setTitle('')
      setDocText('')
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Ingest failed')
    } finally {
      setIngestLoading(false)
    }
  }

  async function handleAsk(e) {
    e.preventDefault()
    setAskError(null)
    setAnswer(null)
    setSources([])
    setAskLoading(true)
    try {
      const r = await askQuestion(question.trim(), topK)
      setAnswer(r.answer)
      setSources(r.sources ?? [])
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setAskLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>AI Assistant</h1>
        <p className="tagline">
          Ingest documents into the RAG index, then ask questions against your
          corpus.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Ingest document</h2>
          <p className="hint">
            POST <code>/api/documents/</code> — title and full text are chunked
            and embedded.
          </p>
          <form onSubmit={handleIngest} className="form">
            <label className="field">
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product FAQ"
                required
                maxLength={255}
                disabled={ingestLoading}
              />
            </label>
            <label className="field">
              <span>Text</span>
              <textarea
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                placeholder="Paste document content…"
                rows={12}
                required
                disabled={ingestLoading}
              />
            </label>
            <button type="submit" disabled={ingestLoading}>
              {ingestLoading ? 'Ingesting…' : 'Ingest'}
            </button>
          </form>
          {ingestMessage && (
            <p className="feedback success" role="status">
              {ingestMessage}
            </p>
          )}
          {ingestError && (
            <p className="feedback error" role="alert">
              {ingestError}
            </p>
          )}
        </section>

        <section className="card">
          <h2>Ask</h2>
          <p className="hint">
            POST <code>/api/ask/</code> — retrieves top chunks and generates an
            answer.
          </p>
          <form onSubmit={handleAsk} className="form">
            <label className="field">
              <span>Question</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to know?"
                rows={4}
                required
                disabled={askLoading}
              />
            </label>
            <label className="field inline">
              <span>Top K</span>
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(e) =>
                  setTopK(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
                }
                disabled={askLoading}
              />
            </label>
            <button type="submit" disabled={askLoading}>
              {askLoading ? 'Thinking…' : 'Ask'}
            </button>
          </form>
          {askError && (
            <p className="feedback error" role="alert">
              {askError}
            </p>
          )}
          {answer !== null && (
            <div className="answer-block">
              <h3>Answer</h3>
              <div className="answer-body">{answer}</div>
              {sources.length > 0 && (
                <details className="sources">
                  <summary>Sources ({sources.length})</summary>
                  <ol>
                    {sources.map((s, i) => (
                      <li key={`${s.chunk_id}-${i}`}>
                        <span className="chunk-id">#{s.chunk_id}</span>
                        <pre>{s.text}</pre>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
