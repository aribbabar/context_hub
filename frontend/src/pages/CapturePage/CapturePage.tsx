import type { FormSubmitHandler, Message, SourceMode, SourceRecord, ViewName } from '../../types'
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

  function openSource(sourceId: string) {
    onSelectSource(sourceId)
    onNavigate('sources')
  }

  return (
    <main>
      <section className={styles.hero} aria-labelledby="capture-heading">
        <h1 id="capture-heading">Capture documentation</h1>
        <p>
          Point Context Hub at a local docs folder or a remote website. We&apos;ll copy, clean, and index it so you can search it later.
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
              <span className={styles.hint}>Registers selected folders and files as one backend source.</span>
              <button className={styles.primaryButton} disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Copying' : 'Copy and register'}
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
              <span className={styles.hint}>Crawls the URL with crawl4ai and stores the cleaned docs.</span>
              <button className={styles.primaryButton} disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Registering' : 'Register website'}
              </button>
            </div>
            <MessageLine message={message} />
          </form>
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
