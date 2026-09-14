import { useCallback, useEffect, useState } from 'react'
import { listDocuments } from './api'
import { AskPanel } from './components/AskPanel'
import { IngestPanel } from './components/IngestPanel'
import './App.css'

const SOURCE_LABELS = { pdf: 'PDF', docx: 'DOCX', plain: 'text file', text: 'pasted' }

function App() {
  const [documents, setDocuments] = useState([])
  const [documentsError, setDocumentsError] = useState(null)

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(await listDocuments())
      setDocumentsError(null)
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : 'Could not load documents')
    }
  }, [])

  useEffect(() => {
    // Loads the index on mount; this also wakes a sleeping backend early.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshDocuments()
  }, [refreshDocuments])

  return (
    <div className="app">
      <header className="header">
        <h1>AI Assistant</h1>
        <p className="tagline">
          Ask questions and get answers grounded only in the indexed documents, with the source
          passages shown. Hybrid search, streaming answers, a tool-calling agent and a LangChain
          comparison.
        </p>
      </header>

      <main className="grid">
        <AskPanel />

        <section className="card">
          <h2>Indexed documents</h2>
          {documentsError && (
            <p className="feedback error" role="alert">
              {documentsError}
            </p>
          )}
          {!documentsError && documents.length === 0 && <p className="hint">No documents yet.</p>}
          {documents.length > 0 && (
            <ul className="doc-list">
              {documents.map((d) => (
                <li key={d.id}>
                  <span>{d.title}</span>
                  <span className="doc-meta">
                    {SOURCE_LABELS[d.source] ?? d.source} · {d.chunks} chunks
                  </span>
                </li>
              ))}
            </ul>
          )}

          <IngestPanel onIngested={refreshDocuments} />
        </section>
      </main>
    </div>
  )
}

export default App
