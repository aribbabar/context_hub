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
  path: string
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
              <label htmlFor="local-path">Folder path</label>
              <div className={styles.pathField}>
                <input
                  id="local-path"
                  onChange={(event) => onLocalFormChange({ ...localForm, path: event.target.value })}
                  placeholder="E:\Projects\my-docs"
                  required
                  type="text"
                  value={localForm.path}
                />
                <button className={styles.secondaryButton} disabled={isPickingFolder} onClick={onPickFolder} type="button">
                  {isPickingFolder ? 'Opening' : 'Browse'}
                </button>
              </div>
            </div>
            <SourceIdentityFields
              name={localForm.name}
              version={localForm.version}
              onNameChange={(name) => onLocalFormChange({ ...localForm, name })}
              onVersionChange={(version) => onLocalFormChange({ ...localForm, version })}
            />
            <div className={styles.formActions}>
              <span className={styles.hint}>Registers a folder and copies it into the backend workspace.</span>
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
