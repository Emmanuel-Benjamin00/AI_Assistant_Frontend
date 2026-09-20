import { useState } from 'react'
import { askAgent, askQuestionStream, askWithLangChain, ServerUnavailableError } from '../api'
import { COLD_START_NOTE } from '../messages'
import { useSlowFlag } from '../useSlowFlag'
import { Sources } from './Sources'

const MAX_QUESTION_CHARS = 2_000

const ENGINES = [
  {
    id: 'rag',
    label: 'RAG · streaming',
    hint: 'Retrieves chunks, then streams an answer grounded in them, token by token.',
  },
  {
    id: 'agent',
    label: 'Agent · tools',
    hint: 'The model calls tools (search, list, read document) until it can answer. Best for summaries and comparisons.',
  },
  {
    id: 'langchain',
    label: 'LangChain',
    hint: 'The same RAG flow rebuilt with LangChain, returned in one response.',
  },
]

const SAMPLE_QUESTIONS = {
  rag: [
    'What is the difference between an 837 and an 835?',
    'What does the CO adjustment group code mean?',
    'How does hybrid search combine its results?',
  ],
  agent: [
    'Summarize the HIPAA privacy document in three bullet points.',
    'Compare the EDI primer and the NEMT operations document.',
    'Which documents are indexed, and what is each one about?',
  ],
  langchain: [
    'What vehicle does a wheelchair rider need?',
    'How long do you have to notify people after a breach?',
  ],
}

function AgentSteps({ steps }) {
  if (!steps.length) return null
  return (
    <details className="sources" open>
      <summary>Tool calls ({steps.length})</summary>
      <ol className="steps">
        {steps.map((step, i) => (
          <li key={i}>
            <code>
              {step.tool}({typeof step.arguments === 'string' ? step.arguments : JSON.stringify(step.arguments)})
            </code>
            <span className="step-summary">→ {step.summary}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export function AskPanel({ serverReady, wakeServer }) {
  const [engine, setEngine] = useState('rag')
  const [question, setQuestion] = useState('')
  const [topK, setTopK] = useState(5)
  const [mode, setMode] = useState('hybrid')
  const [rerank, setRerank] = useState(false)

  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [sources, setSources] = useState([])
  const [steps, setSteps] = useState([])
  const [documentsRead, setDocumentsRead] = useState([])
  const [error, setError] = useState(null)

  // Only "slow" until the first token arrives; after that the user can see progress.
  const slow = useSlowFlag(loading && !streaming)
  const waking = useSlowFlag(!serverReady)
  const current = ENGINES.find((e) => e.id === engine)

  async function runAsk(q, options) {
    if (engine === 'rag') {
      await askQuestionStream(q, options, {
        onSources: setSources,
        onToken: (text) => {
          setStreaming(true)
          setAnswer((prev) => (prev ?? '') + text)
        },
      })
    } else if (engine === 'agent') {
      const r = await askAgent(q)
      setAnswer(r.answer)
      setSources(r.sources ?? [])
      setSteps(r.steps ?? [])
      setDocumentsRead(r.documents_read ?? [])
    } else {
      const r = await askWithLangChain(q, options)
      setAnswer(r.answer)
      setSources(r.sources ?? [])
    }
  }

  async function handleAsk(e) {
    e.preventDefault()
    setError(null)
    setAnswer(null)
    setSources([])
    setSteps([])
    setDocumentsRead([])
    setLoading(true)
    const q = question.trim()
    const options = { topK, mode, rerank }
    try {
      await runAsk(q, options).catch(async (err) => {
        // The server fell asleep, so the question never ran: wait for it to wake, then ask again.
        if (!(err instanceof ServerUnavailableError) || !(await wakeServer())) throw err
        return runAsk(q, options)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  return (
    <section className="card">
      <h2>Ask</h2>

      <div className="segmented" role="radiogroup" aria-label="Answer engine">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={engine === e.id}
            className={engine === e.id ? 'active' : ''}
            onClick={() => setEngine(e.id)}
            disabled={loading}
          >
            {e.label}
          </button>
        ))}
      </div>
      <p className="hint">{current.hint}</p>

      <div className="samples">
        {SAMPLE_QUESTIONS[engine].map((q) => (
          <button key={q} type="button" className="chip" onClick={() => setQuestion(q)} disabled={loading}>
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={handleAsk} className="form">
        <label className="field">
          <span>Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to know?"
            rows={4}
            required
            maxLength={MAX_QUESTION_CHARS}
            disabled={loading}
          />
        </label>

        {engine !== 'agent' && (
          <div className="options">
            <label className="field inline">
              <span>Search</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={loading}>
                <option value="hybrid">Hybrid (keyword + vector)</option>
                <option value="vector">Vector only</option>
              </select>
            </label>
            <label className="field inline">
              <span>Top K</span>
              <input
                type="number"
                min={1}
                max={10}
                value={topK}
                onChange={(e) => setTopK(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                disabled={loading}
              />
            </label>
            <label className="field inline checkbox">
              <input
                type="checkbox"
                checked={rerank}
                onChange={(e) => setRerank(e.target.checked)}
                disabled={loading}
              />
              <span>Re-rank with LLM</span>
            </label>
          </div>
        )}

        <button type="submit" disabled={loading || !serverReady}>
          {loading ? (streaming ? 'Answering…' : 'Thinking…') : waking ? 'Waking up server…' : 'Ask'}
        </button>
      </form>

      {waking && !loading && (
        <p className="feedback notice" role="status">
          Waking up the server, hang on. {COLD_START_NOTE} You can type your question in the
          meantime.
        </p>
      )}
      {slow && (
        <p className="feedback notice" role="status">
          Still working, hang on. {COLD_START_NOTE}
        </p>
      )}
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {answer !== null && (
        <div className="answer-block">
          <h3>Answer</h3>
          <div className="answer-body" aria-live="polite">
            {answer}
            {streaming && <span className="cursor" aria-hidden="true" />}
          </div>
          <AgentSteps steps={steps} />
          {documentsRead.length > 0 && (
            <p className="hint read-docs">
              Read in full: {documentsRead.map((d) => d.document_title).join(', ')}
            </p>
          )}
          <Sources sources={sources} />
        </div>
      )}
    </section>
  )
}
