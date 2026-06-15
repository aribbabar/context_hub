import type { FormSubmitHandler, IndexJob, Message, SourceMode, SourceRecord, ViewName } from '../../types'
import { SourceIdentityFields } from '../../components/forms/SourceIdentityFields/SourceIdentityFields'
import { ModeTabs } from '../../components/source/ModeTabs/ModeTabs'
import { Badge } from '../../components/ui/Badge/Badge'
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
  onNavigate: (view: ViewName) => void
  onSelectSource: (sourceId: string) => void
}

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
