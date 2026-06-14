import type { FormSubmitHandler, IndexJob, SourceRecord } from '../../types'
import { Badge } from '../../components/ui/Badge/Badge'
import { PageHeading } from '../../components/ui/PageHeading/PageHeading'
import styles from './SourcesPage.module.css'

type SourcesPageProps = {
  activeLogs: string
  isSearching: boolean
  latestJob: IndexJob | undefined
  query: string
  searchLimit: number
  searchOutput: string
  selectedSource: SourceRecord | undefined
  sources: SourceRecord[]
  onQueryChange: (query: string) => void
  onRefreshSources: () => Promise<void>
  onSearchDocs: FormSubmitHandler
  onSearchLimitChange: (limit: number) => void
  onSelectSource: (sourceId: string) => void
  onStartIndexing: () => void
}

export function SourcesPage({
  activeLogs,
  isSearching,
  latestJob,
  query,
  searchLimit,
  searchOutput,
  selectedSource,
  sources,
  onQueryChange,
  onRefreshSources,
  onSearchDocs,
  onSearchLimitChange,
  onSelectSource,
  onStartIndexing,
}: SourcesPageProps) {
  return (
    <main>
      <PageHeading
        title="Source workbench"
        text="Manage registered docs, run index jobs, and query the indexed corpus."
      />

      <section className={styles.panel} aria-labelledby="registry-title">
        <div className={styles.panelHeader}>
          <h2 id="registry-title">Registry</h2>
          <button className={styles.secondaryButton} onClick={() => void onRefreshSources()} type="button">
            Refresh
          </button>
        </div>

        {sources.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.sourceTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr
                    className={selectedSource?.id === source.id ? styles.selected : undefined}
                    key={source.id}
                    onClick={() => onSelectSource(source.id)}
                  >
                    <td>{source.name}</td>
                    <td>
                      <Badge value={source.kind.replace('_', ' ')} variant={source.kind} />
                    </td>
                    <td>{source.version}</td>
                    <td>
                      <Badge value={source.status} variant={source.status} />
                    </td>
                    <td className={styles.locationCell} title={source.origin_location}>
                      {source.origin_location}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>No sources registered. Capture one first.</div>
        )}
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.panel} aria-labelledby="ops-title">
          <div className={styles.panelHeader}>
            <h2 id="ops-title">Selected source</h2>
          </div>
          {selectedSource ? (
            <>
              <dl className={styles.detailList}>
                <div>
                  <dt>Original location</dt>
                  <dd>{selectedSource.origin_location}</dd>
                </div>
                <div>
                  <dt>Backend copy</dt>
                  <dd>{selectedSource.working_path ?? 'Not generated yet'}</dd>
                </div>
                <div>
                  <dt>docs-mcp URL</dt>
                  <dd>{selectedSource.docs_mcp_url ?? 'Not generated yet'}</dd>
                </div>
              </dl>
              <button className={styles.primaryButton} onClick={onStartIndexing} type="button">
                Run index job
              </button>
            </>
          ) : (
            <div className={styles.emptyState}>Select a source from the registry.</div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="progress-title">
          <div className={styles.panelHeader}>
            <h2 id="progress-title">Latest job</h2>
          </div>
          {latestJob ? (
            <>
              <p className={styles.jobStatus}>{latestJob.status}</p>
              <div className={styles.progressBar}>
                <span style={{ width: `${latestJob.progress}%` }} />
              </div>
              <div className={styles.jobMeta}>
                <span>{latestJob.progress}% complete</span>
                <span>Job {latestJob.id.slice(0, 8)}</span>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>No job selected.</div>
          )}
        </section>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.panel} aria-labelledby="logs-title">
          <div className={styles.panelHeader}>
            <h2 id="logs-title">Job logs</h2>
          </div>
          <pre className={styles.codeBlock}>{activeLogs || 'No logs yet.'}</pre>
        </section>

        <section className={styles.panel} aria-labelledby="search-title">
          <div className={styles.panelHeader}>
            <h2 id="search-title">Search indexed docs</h2>
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
          <pre className={styles.codeBlock}>{searchOutput || 'No results yet.'}</pre>
        </section>
      </div>
    </main>
  )
}
