/** Retrieved chunks behind an answer, numbered to match the [n] citations. */
export function Sources({ sources }) {
  if (!sources.length) return null
  return (
    <details className="sources">
      <summary>Sources ({sources.length})</summary>
      <ol>
        {sources.map((s, i) => (
          <li key={`${s.chunk_id}-${i}`} value={s.ref ?? i + 1}>
            <span className="chunk-id">
              {s.document_title ?? `#${s.chunk_id}`}
              {s.page ? ` · page ${s.page}` : ''}
            </span>
            <span className="badges">
              {typeof s.similarity === 'number' && (
                <span className="badge" title="Cosine similarity to the question">
                  similarity {s.similarity.toFixed(2)}
                </span>
              )}
              {s.vector_rank != null && (
                <span className="badge" title="Rank in the vector (semantic) search">
                  vector #{s.vector_rank}
                </span>
              )}
              {s.keyword_rank != null && (
                <span className="badge" title="Rank in the keyword (full-text) search">
                  keyword #{s.keyword_rank}
                </span>
              )}
              {s.rerank_score != null && (
                <span className="badge strong" title="Relevance score from the LLM re-ranker (0-10)">
                  rerank {s.rerank_score}
                </span>
              )}
            </span>
            <pre>{s.text}</pre>
          </li>
        ))}
      </ol>
    </details>
  )
}
