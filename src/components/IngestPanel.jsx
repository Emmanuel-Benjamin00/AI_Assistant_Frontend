import { useState } from 'react'
import { ingestDocument, ServerUnavailableError, uploadDocument } from '../api'
import { useSlowFlag } from '../useSlowFlag'

const MAX_DOCUMENT_CHARS = 100_000
const MAX_UPLOAD_MB = 10
const ACCEPTED_FILES = '.pdf,.docx,.txt,.md,.markdown'

export function IngestPanel({ onIngested, serverReady, wakeServer }) {
  const [tab, setTab] = useState('upload')
  const [title, setTitle] = useState('')
  const [docText, setDocText] = useState('')
  const [file, setFile] = useState(null)
  // Changing the key remounts the file input, which is the only way to clear it.
  const [fileInputKey, setFileInputKey] = useState(0)
  const [ingestKey, setIngestKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const slow = useSlowFlag(loading)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (tab === 'upload' && file && file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_UPLOAD_MB} MB.`)
      return
    }
    setLoading(true)
    try {
      const r =
        tab === 'upload'
          ? await uploadDocument(file, title.trim(), ingestKey.trim())
          : await ingestDocument(title.trim(), docText, ingestKey.trim())
      setMessage(`Indexed document #${r.document_id} (${r.chunks_created} chunks, ${r.source}).`)
      setTitle('')
      setDocText('')
      setFile(null)
      setFileInputKey((k) => k + 1)
      onIngested()
    } catch (err) {
      if (err instanceof ServerUnavailableError) {
        // Not retried automatically: a slow upload may still have been indexed.
        wakeServer()
        setError(`${err.message} Check the document list once it reloads before trying again.`)
      } else {
        setError(err instanceof Error ? err.message : 'Ingest failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="section-gap">Add a document</h2>
      <div className="segmented" role="tablist" aria-label="Document input">
        {[
          ['upload', 'Upload file'],
          ['paste', 'Paste text'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
            disabled={loading}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="hint">
        {tab === 'upload'
          ? `PDF, DOCX, TXT or Markdown, up to ${MAX_UPLOAD_MB} MB. PDF chunks keep their page numbers.`
          : 'Title and text are chunked and embedded.'}{' '}
        On the hosted demo this needs an access key.
      </p>

      <form onSubmit={handleSubmit} className="form">
        {tab === 'upload' ? (
          <label className="field">
            <span>File</span>
            <input
              key={fileInputKey}
              type="file"
              accept={ACCEPTED_FILES}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              disabled={loading}
            />
          </label>
        ) : null}

        <label className="field">
          <span>{tab === 'upload' ? 'Title (optional, defaults to the file name)' : 'Title'}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Product FAQ"
            required={tab === 'paste'}
            maxLength={255}
            disabled={loading}
          />
        </label>

        {tab === 'paste' && (
          <label className="field">
            <span>
              Text ({docText.length.toLocaleString()} / {MAX_DOCUMENT_CHARS.toLocaleString()})
            </span>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste document content…"
              rows={10}
              required
              maxLength={MAX_DOCUMENT_CHARS}
              disabled={loading}
            />
          </label>
        )}

        <label className="field">
          <span>Access key (only if the server requires one)</span>
          <input
            type="password"
            value={ingestKey}
            onChange={(e) => setIngestKey(e.target.value)}
            autoComplete="off"
            disabled={loading}
          />
        </label>
        <button type="submit" disabled={loading || !serverReady}>
          {loading ? 'Indexing…' : tab === 'upload' ? 'Upload' : 'Ingest'}
        </button>
      </form>

      {slow && (
        <p className="feedback notice" role="status">
          Still working. Large documents and a waking server can take a while.
        </p>
      )}
      {message && (
        <p className="feedback success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
