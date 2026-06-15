import type { FormSubmitHandler, Message, SearchResponse, SourceRecord } from '../../types'
import { Badge } from '../../components/ui/Badge/Badge'
import { MessageLine } from '../../components/ui/MessageLine/MessageLine'
import { PageHeading } from '../../components/ui/PageHeading/PageHeading'
import styles from './SourcesPage.module.css'

type SourcesPageProps = {
  deletingSourceId: string | null
  isSearching: boolean
  message: Message
  query: string
  searchLimit: number
  searchOutput: SearchResponse | null
  selectedSource: SourceRecord | undefined
  sources: SourceRecord[]
  totalSourceCount: number
  onDeleteSource: (sourceId: string) => void
  onQueryChange: (query: string) => void
  onRefreshSources: () => Promise<void>
  onSearchDocs: FormSubmitHandler
  onSearchLimitChange: (limit: number) => void
  onSelectSource: (sourceId: string) => void
}

export function SourcesPage({
  deletingSourceId,
  isSearching,
  message,
  query,
  searchLimit,
  searchOutput,
  selectedSource,
  sources,
  totalSourceCount,
  onDeleteSource,
  onQueryChange,
  onRefreshSources,
  onSearchDocs,
  onSearchLimitChange,
  onSelectSource,
}: SourcesPageProps) {
  return (
    <main>
      <PageHeading
        title="Indexed sources"
        text="View indexed documentation sources and run searches against the selected corpus."
      />

      <section className={styles.panel} aria-labelledby="registry-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="registry-title">Registry</h2>
            <p>{sources.length} indexed source{sources.length === 1 ? '' : 's'}</p>
          </div>
          <button className={styles.secondaryButton} onClick={() => void onRefreshSources()} type="button">
            Refresh
          </button>
        </div>
        <MessageLine message={message} />

        {sources.length ? (
          <div className={styles.sourceList}>
            {sources.map((source) => (
              <div
                aria-current={selectedSource?.id === source.id ? 'true' : undefined}
                className={selectedSource?.id === source.id ? styles.selectedSource : undefined}
                key={source.id}
              >
                <button className={styles.sourceSelect} onClick={() => onSelectSource(source.id)} type="button">
                  <span className={styles.sourceIdentity}>
                    <strong>{source.name}</strong>
                    <span title={source.origin_location}>{source.origin_location}</span>
                  </span>
                </button>
                <span className={styles.sourceMeta}>
                  <Badge value={source.kind.replace('_', ' ')} variant={source.kind} />
                  <Badge value={source.version} variant="registered" />
                  <button
                    className={styles.dangerButton}
                    disabled={deletingSourceId === source.id}
                    onClick={() => onDeleteSource(source.id)}
                    type="button"
                  >
                    {deletingSourceId === source.id ? 'Deleting' : 'Delete'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {totalSourceCount ? 'No indexed sources yet. Check Capture for active indexing progress.' : 'No sources indexed yet.'}
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="search-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="search-title">Search</h2>
            <p>{selectedSource ? selectedSource.name : 'Select an indexed source'}</p>
          </div>
        </div>
        <form className={styles.searchForm} onSubmit={onSearchDocs}>
          <div className={styles.field}>
            <label htmlFor="query">Query</label>
            <input
              id="query"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Find installation steps..."
              required
              type="text"
              value={query}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="limit">Limit</label>
            <input
              id="limit"
              max="25"
              min="1"
              onChange={(event) => onSearchLimitChange(Number(event.target.value))}
              required
              type="number"
              value={searchLimit}
            />
          </div>
          <button className={styles.primaryButton} disabled={!selectedSource || isSearching} type="submit">
            {isSearching ? 'Searching' : 'Search'}
          </button>
        </form>
        <SearchResults output={searchOutput} />
      </section>
    </main>
  )
}

function SearchResults({ output }: { output: SearchResponse | null }) {
  if (!output) {
    return <div className={styles.emptyState}>No results yet.</div>
  }

  if (output.stderr) {
    return <div className={styles.errorState}>{output.stderr}</div>
  }

  if (Array.isArray(output.results)) {
    if (!output.results.length) {
      return <div className={styles.emptyState}>No matching results.</div>
    }

    return (
      <div className={styles.resultList}>
        {output.results.map((result, index) => (
          <ResultCard key={index} result={result} index={index} />
        ))}
      </div>
    )
  }

  if (output.results && typeof output.results === 'object') {
    return (
      <div className={styles.resultList}>
        <ResultCard result={output.results} index={0} />
      </div>
    )
  }

  return <div className={styles.plainOutput}>{output.stdout || 'No matching results.'}</div>
}

function ResultCard({ result, index }: { result: unknown; index: number }) {
  if (!result || typeof result !== 'object') {
    return (
      <article className={styles.resultCard}>
        <span className={styles.resultIndex}>Result {index + 1}</span>
        <p>{String(result)}</p>
      </article>
    )
  }

  const record = result as Record<string, unknown>
  const rawTitle = pickString(record, ['title', 'name', 'heading', 'url', 'source'])
  const snippet = pickString(record, ['content', 'text', 'snippet', 'summary', 'pageContent', 'document'])
  const source = pickString(record, ['url', 'source', 'path', 'file', 'location'])
  const title = formatTitle(rawTitle, source, index)
  const score = pickNumber(record, ['score', 'similarity', 'distance'])
  const metadata = Object.entries(record).filter(([key]) => !['title', 'name', 'heading', 'url', 'source', 'content', 'text', 'snippet', 'summary', 'pageContent', 'document', 'path', 'file', 'location', 'score', 'similarity', 'distance'].includes(key))

  return (
    <article className={styles.resultCard}>
      <div className={styles.resultHeader}>
        <div>
          <span className={styles.resultIndex}>Result {index + 1}</span>
          <h3>{title}</h3>
        </div>
        {typeof score === 'number' ? <span className={styles.score}>{formatScore(score)}</span> : null}
      </div>
      {source ? <p className={styles.resultSource}>{source}</p> : null}
      {snippet ? <p className={styles.snippet}>{formatSnippet(snippet)}</p> : null}
      {metadata.length ? (
        <dl className={styles.metadataList}>
          {metadata.slice(0, 6).map(([key, value]) => (
            <div key={key}>
              <dt>{humanizeKey(key)}</dt>
              <dd>{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  )
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number') return value
  }
  return null
}

function formatScore(score: number) {
  return Math.abs(score) <= 1 ? score.toFixed(3) : score.toFixed(1)
}

function formatTitle(title: string | null, source: string | null, index: number) {
  const value = title ?? source
  if (!value) return `Result ${index + 1}`

  try {
    const url = new URL(value)
    const lastSegment = url.pathname.split('/').filter(Boolean).pop()
    return lastSegment || url.hostname || value
  } catch {
    return value
  }
}

function formatSnippet(snippet: string) {
  const normalized = snippet.replace(/\s+\n/g, '\n').trim()
  return normalized.length > 1200 ? `${normalized.slice(0, 1200).trim()}...` : normalized
}

function humanizeKey(key: string) {
  return key.replace(/[_-]/g, ' ')
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return 'None'
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${humanizeKey(key)}: ${formatValue(item)}`)
    .join(', ')
}
