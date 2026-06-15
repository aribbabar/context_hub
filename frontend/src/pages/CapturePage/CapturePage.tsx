import type { CrawlScope, FormSubmitHandler, IndexJob, Message, SourceMode, SourceRecord, ViewName } from '../../types'
import { SourceIdentityFields } from '../../components/forms/SourceIdentityFields/SourceIdentityFields'
import { ModeTabs } from '../../components/source/ModeTabs/ModeTabs'
import { Badge } from '../../components/ui/Badge/Badge'
import { DropdownSelect } from '../../components/ui/DropdownSelect/DropdownSelect'
import { MessageLine } from '../../components/ui/MessageLine/MessageLine'
import styles from './CapturePage.module.css'

type SourceForm = {
  name: string
  version: string
}

type LocalForm = SourceForm & {
  paths: string[]
}

type WebForm = SourceForm & {
  url: string
  maxPages: number
  maxDepth: number
  maxConcurrency: number
  includePatterns: string
  excludePatterns: string
  scope: CrawlScope
  preserveHashes: boolean
  followRedirects: boolean
  ignoreErrors: boolean
  clean: boolean
}

type CapturePageProps = {
  activeLogs: string
  latestJob: IndexJob | undefined
  selectedSource: SourceRecord | undefined
  mode: SourceMode
  message: Message
  recentSources: SourceRecord[]
  localForm: LocalForm
  webForm: WebForm
  isPickingFolder: boolean
  isSubmitting: boolean
  onModeChange: (mode: SourceMode) => void
  onLocalFormChange: (form: LocalForm) => void
  onWebFormChange: (form: WebForm) => void
  onPickFolder: () => void
  onRemoveLocalPath: (path: string) => void
  onRegisterLocal: FormSubmitHandler
  onRegisterWeb: FormSubmitHandler
  onResetWebPreferences: () => void
  onNavigate: (view: ViewName) => void
  onSelectSource: (sourceId: string) => void
}

const scopeOptions: Array<{
  value: CrawlScope
  label: string
  description: string
  tooltip: string
}> = [
  {
    value: 'hostname',
    label: 'Hostname',
    description: 'Crawl any matching path on the same host.',
    tooltip: 'Best default for docs sites. With /docs/* it stays on pages like neon.com/docs/...',
  },
  {
    value: 'subpages',
    label: 'Subpages',
    description: 'Only crawl below the exact starting URL.',
    tooltip: 'Use this for a narrow section like /docs/introduction and its child pages.',
  },
  {
    value: 'domain',
    label: 'Domain',
    description: 'Allow matching links across the root domain.',
    tooltip: 'Use when docs move between subdomains, such as docs.example.com and www.example.com.',
  },
]

export function CapturePage({
  activeLogs,
  latestJob,
  selectedSource,
  mode,
  message,
  recentSources,
  localForm,
  webForm,
  isPickingFolder,
  isSubmitting,
  onModeChange,
  onLocalFormChange,
  onWebFormChange,
  onPickFolder,
  onRemoveLocalPath,
  onRegisterLocal,
  onRegisterWeb,
  onResetWebPreferences,
  onNavigate,
  onSelectSource,
}: CapturePageProps) {
  const isLocal = mode === 'local'
  const stage = describeJobStage(latestJob, selectedSource)
  const lastLogLine = latestLogLine(activeLogs)

  function openSource(sourceId: string) {
    onSelectSource(sourceId)
    onNavigate('sources')
  }

  return (
    <main>
      <section className={styles.hero} aria-labelledby="capture-heading">
        <h1 id="capture-heading">Capture documentation</h1>
        <p>
          Point Context Hub at a local docs folder or a remote website. It starts indexing immediately and reports the current stage here.
        </p>
      </section>

      <section className={styles.captureCard} aria-labelledby="capture-title">
        <h2 id="capture-title" className={styles.visuallyHidden}>
          Add a source
        </h2>

        <ModeTabs mode={mode} onModeChange={onModeChange} />

        {isLocal ? (
          <form onSubmit={onRegisterLocal}>
            <div className={styles.field}>
              <label htmlFor="local-paths">Local paths</label>
              <div className={styles.pathField}>
                <textarea
                  id="local-paths"
                  onChange={(event) =>
                    onLocalFormChange({
                      ...localForm,
                      paths: event.target.value.split(/\r?\n/),
                    })
                  }
                  placeholder="E:\Projects\my-docs"
                  value={localForm.paths.join('\n')}
                />
                <button className={styles.secondaryButton} disabled={isPickingFolder} onClick={onPickFolder} type="button">
                  {isPickingFolder ? 'Opening' : 'Browse'}
                </button>
              </div>
              {localForm.paths.filter(Boolean).length ? (
                <div className={styles.selectedPathList}>
                  {localForm.paths.filter(Boolean).map((path) => (
                    <span className={styles.selectedPath} key={path}>
                      <span title={path}>{path}</span>
                      <button onClick={() => onRemoveLocalPath(path)} type="button" aria-label={`Remove ${path}`}>
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <SourceIdentityFields
              name={localForm.name}
              version={localForm.version}
              onNameChange={(name) => onLocalFormChange({ ...localForm, name })}
              onVersionChange={(version) => onLocalFormChange({ ...localForm, version })}
            />
            <div className={styles.formActions}>
              <span className={styles.hint}>Registers selected folders and files, then starts indexing.</span>
              <button className={styles.primaryButton} disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Starting' : 'Index selected docs'}
              </button>
            </div>
            <MessageLine message={message} />
          </form>
        ) : (
          <form onSubmit={onRegisterWeb}>
            <div className={styles.field}>
              <label htmlFor="web-url">Docs URL</label>
              <input
                id="web-url"
                onChange={(event) => onWebFormChange({ ...webForm, url: event.target.value })}
                placeholder="https://docs.example.com"
                required
                type="url"
                value={webForm.url}
              />
            </div>
            <SourceIdentityFields
              name={webForm.name}
              version={webForm.version}
              onNameChange={(name) => onWebFormChange({ ...webForm, name })}
              onVersionChange={(version) => onWebFormChange({ ...webForm, version })}
            />
            <details className={styles.advancedOptions}>
              <summary>Advanced crawl options</summary>
              <div className={styles.advancedActions}>
                <button className={styles.resetButton} onClick={onResetWebPreferences} type="button">
                  Reset defaults
                </button>
              </div>
              <div className={styles.optionGrid}>
                <div className={styles.field}>
                  <label htmlFor="web-max-pages">Max pages</label>
                  <input
                    id="web-max-pages"
                    max="1000"
                    min="1"
                    onChange={(event) => onWebFormChange({ ...webForm, maxPages: Number(event.target.value) })}
                    required
                    type="number"
                    value={webForm.maxPages}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="web-max-depth">Max depth</label>
                  <input
                    id="web-max-depth"
                    max="10"
                    min="0"
                    onChange={(event) => onWebFormChange({ ...webForm, maxDepth: Number(event.target.value) })}
                    required
                    type="number"
                    value={webForm.maxDepth}
                  />
                </div>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="web-max-concurrency">Concurrency</label>
                    <FieldTooltip text="How many pages the crawler requests at once. Four is a safe default for speed without hammering docs sites." />
                  </div>
                  <input
                    id="web-max-concurrency"
                    max="32"
                    min="1"
                    onChange={(event) => onWebFormChange({ ...webForm, maxConcurrency: Number(event.target.value) })}
                    required
                    type="number"
                    value={webForm.maxConcurrency}
                  />
                </div>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="web-scope">Scope</label>
                    <FieldTooltip text="Hostname plus the default /docs include pattern usually captures the whole docs section. Subpages stays below the exact starting URL." />
                  </div>
                  <ScopeSelect
                    onChange={(scope) => onWebFormChange({ ...webForm, scope })}
                    value={webForm.scope}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="web-include-patterns">Include patterns</label>
                <textarea
                  id="web-include-patterns"
                  onChange={(event) => onWebFormChange({ ...webForm, includePatterns: event.target.value })}
                  placeholder="/docs/*"
                  value={webForm.includePatterns}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="web-exclude-patterns">Exclude patterns</label>
                <textarea
                  id="web-exclude-patterns"
                  onChange={(event) => onWebFormChange({ ...webForm, excludePatterns: event.target.value })}
                  placeholder="**/CHANGELOG.md&#10;**/LICENSE"
                  value={webForm.excludePatterns}
                />
              </div>
              <div className={styles.checkboxGrid}>
                <label>
                  <input
                    checked={webForm.preserveHashes}
                    onChange={(event) => onWebFormChange({ ...webForm, preserveHashes: event.target.checked })}
                    type="checkbox"
                  />
                  <span>Preserve hash routes</span>
                  <FieldTooltip text="Keep URL fragments like #install as separate crawl targets when a docs site uses hash routes for real pages." />
                </label>
                <label>
                  <input
                    checked={webForm.followRedirects}
                    onChange={(event) => onWebFormChange({ ...webForm, followRedirects: event.target.checked })}
                    type="checkbox"
                  />
                  <span>Follow redirects</span>
                  <FieldTooltip text="Allow the crawler to follow moved pages and canonical docs URLs." />
                </label>
                <label>
                  <input
                    checked={webForm.ignoreErrors}
                    onChange={(event) => onWebFormChange({ ...webForm, ignoreErrors: event.target.checked })}
                    type="checkbox"
                  />
                  <span>Ignore scrape errors</span>
                  <FieldTooltip text="Continue indexing when individual pages fail instead of failing the whole crawl." />
                </label>
                <label>
                  <input
                    checked={webForm.clean}
                    onChange={(event) => onWebFormChange({ ...webForm, clean: event.target.checked })}
                    type="checkbox"
                  />
                  <span>Clean before indexing</span>
                  <FieldTooltip text="Replace the previous generated crawl output for this source before indexing the new run." />
                </label>
              </div>
            </details>
            <div className={styles.formActions}>
              <span className={styles.hint}>Crawls the URL, stores cleaned docs, then indexes them.</span>
              <button className={styles.primaryButton} disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Starting' : 'Index website'}
              </button>
            </div>
            <MessageLine message={message} />
          </form>
        )}
      </section>

      <section className={styles.progressPanel} aria-labelledby="progress-title">
        <div className={styles.sectionHeading}>
          <h2 id="progress-title">Index progress</h2>
          {selectedSource ? <Badge value={selectedSource.status} variant={selectedSource.status} /> : null}
        </div>

        {latestJob && selectedSource ? (
          <div className={styles.progressContent}>
            <div className={styles.progressSummary}>
              <div>
                <strong>{stage.label}</strong>
                <span>{selectedSource.name}</span>
              </div>
              <span>{latestJob.progress}%</span>
            </div>
            <div className={styles.progressBar} aria-label={`${latestJob.progress}% complete`}>
              <span style={{ width: `${latestJob.progress}%` }} />
            </div>
            <ol className={styles.stageList}>
              {stage.steps.map((step) => (
                <li className={styles[step.state]} key={step.label}>
                  <span />
                  {step.label}
                </li>
              ))}
            </ol>
            <div className={styles.jobDetail}>
              <span>Job {latestJob.id.slice(0, 8)}</span>
              <span>{latestJob.command.join(' ')}</span>
            </div>
            {latestJob.error || lastLogLine ? (
              <p className={styles.logLine}>{latestJob.error ?? lastLogLine}</p>
            ) : null}
          </div>
        ) : (
          <div className={styles.emptyState}>No indexing job has started yet.</div>
        )}
      </section>

      <section className={styles.recentPanel} aria-labelledby="recent-title">
        <div className={styles.sectionHeading}>
          <h2 id="recent-title">Recent sources</h2>
          <button className={styles.linkButton} onClick={() => onNavigate('sources')} type="button">
            View all
          </button>
        </div>
        <div className={styles.sourceList}>
          {recentSources.length ? (
            recentSources.map((source) => (
              <button className={styles.sourceItem} key={source.id} onClick={() => openSource(source.id)} type="button">
                <span className={styles.sourceMeta}>
                  <strong>{source.name}</strong>
                  <span>{source.origin_location}</span>
                </span>
                <Badge value={source.kind.replace('_', ' ')} variant={source.kind} />
                <Badge value={source.status} variant={source.status} />
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>No sources yet. Add a folder or URL above.</div>
          )}
        </div>
      </section>
    </main>
  )
}

function describeJobStage(job: IndexJob | undefined, source: SourceRecord | undefined) {
  const isWeb = source?.kind === 'web'
  const labels = isWeb
    ? ['Queued', 'Crawling', 'Preparing docs-mcp input', 'Indexing', 'Complete']
    : ['Queued', 'Preparing local source', 'Indexing', 'Complete']

  let activeIndex = 0
  let label = 'Waiting'

  if (job) {
    if (job.status === 'failed') {
      activeIndex = Math.max(labels.length - 2, 0)
      label = 'Indexing failed'
    } else if (job.status === 'succeeded') {
      activeIndex = labels.length - 1
      label = 'Indexed'
    } else if (isWeb && job.progress >= 55) {
      activeIndex = 2
      label = 'Preparing docs-mcp input'
    } else if (job.progress >= 60) {
      activeIndex = isWeb ? 3 : 2
      label = 'Indexing with docs-mcp'
    } else if (job.progress > 0) {
      activeIndex = 1
      label = isWeb ? 'Crawling website' : 'Preparing local source'
    } else {
      label = 'Queued'
    }
  }

  return {
    label,
    steps: labels.map((stepLabel, index) => ({
      label: stepLabel,
      state: index < activeIndex || job?.status === 'succeeded' ? 'done' : index === activeIndex ? 'active' : 'pending',
    })),
  }
}

function latestLogLine(logs: string) {
  return logs
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
}

function ScopeSelect({ value, onChange }: { value: CrawlScope; onChange: (value: CrawlScope) => void }) {
  return (
    <DropdownSelect
      id="web-scope"
      label="Scope"
      onChange={onChange}
      options={scopeOptions}
      value={value}
    />
  )
}

function FieldTooltip({ text }: { text: string }) {
  return (
    <span className={styles.tooltip} tabIndex={0} aria-label={text}>
      ?
      <span role="tooltip">{text}</span>
    </span>
  )
}
