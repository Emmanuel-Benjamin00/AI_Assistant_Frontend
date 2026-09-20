import { useCallback, useEffect, useRef, useState } from 'react'
import { listDocuments, retryWhileStarting, ServerUnavailableError } from './api'
import { AskPanel } from './components/AskPanel'
import { IngestPanel } from './components/IngestPanel'
import { COLD_START_NOTE } from './messages'
import { useSlowFlag } from './useSlowFlag'
import './App.css'

const SOURCE_LABELS = { pdf: 'PDF', docx: 'DOCX', plain: 'text file', text: 'pasted' }

function App() {
  const [documents, setDocuments] = useState([])
  const [documentsError, setDocumentsError] = useState(null)
  // False until the backend first answers, and again while a panel waits for it to wake.
  const [serverReady, setServerReady] = useState(false)
  const pendingLoad = useRef(null)

  /** Load the index, waiting for a sleeping backend. Resolves to whether the server answered. */
  const refreshDocuments = useCallback(() => {
    // One attempt at a time, so panels that find the server asleep share the same wake-up.
    if (!pendingLoad.current) {
      setDocumentsError(null)
      pendingLoad.current = retryWhileStarting(listDocuments)
        .then((docs) => {
          setDocuments(docs)
          setServerReady(true)
          return true
        })
        .catch((err) => {
          setDocumentsError(err instanceof Error ? err.message : 'Could not load documents')
          // Any real answer, even an error, means the server is up.
          const answered = !(err instanceof ServerUnavailableError)
          if (answered) setServerReady(true)
          return answered
        })
        .finally(() => {
          pendingLoad.current = null
        })
    }
    return pendingLoad.current
  }, [])

  const wakeServer = useCallback(() => {
    setServerReady(false)
    return refreshDocuments()
  }, [refreshDocuments])

  const waking = useSlowFlag(!serverReady && !documentsError)

  useEffect(() => {
    // Loads the index on mount; this also wakes a sleeping backend early.
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
        <AskPanel serverReady={serverReady} wakeServer={wakeServer} />

        <section className="card">
          <h2>Indexed documents</h2>
          {documentsError && (
            <div className="feedback error" role="alert">
              <p>{documentsError}</p>
              {!serverReady && (
                <button type="button" className="chip" onClick={refreshDocuments}>
                  Try again
                </button>
              )}
            </div>
          )}
          {!documentsError && documents.length === 0 && (
            <p className="hint" role="status">
              {serverReady
                ? 'No documents yet.'
                : waking
                  ? `Waking up the server, hang on. ${COLD_START_NOTE}`
                  : 'Loading documents…'}
            </p>
          )}
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

          <IngestPanel
            onIngested={refreshDocuments}
            serverReady={serverReady}
            wakeServer={wakeServer}
          />
        </section>
      </main>
    </div>
  )
}

export default App
