import type { EmbeddingMode, EmbeddingSettings, FormSubmitHandler, Message, OllamaStatus } from '../../types'
import { MessageLine } from '../../components/ui/MessageLine/MessageLine'
import { PageHeading } from '../../components/ui/PageHeading/PageHeading'
import styles from './SettingsPage.module.css'

type SettingsPageProps = {
  embeddingSettings: EmbeddingSettings
  isSavingSettings: boolean
  message: Message
  ollamaStatus: OllamaStatus | null
  onSaveSettings: FormSubmitHandler
  onSettingsChange: (settings: EmbeddingSettings) => void
}

export function SettingsPage({
  embeddingSettings,
  isSavingSettings,
  message,
  ollamaStatus,
  onSaveSettings,
  onSettingsChange,
}: SettingsPageProps) {
  const isDisabled = embeddingSettings.mode === 'disabled'

  return (
    <main>
      <PageHeading title="Settings" text="Configure how indexed documentation is embedded and searched." />

      <section className={styles.settingsCard} aria-labelledby="settings-title">
        <h2 id="settings-title">Embedding model</h2>
        <form onSubmit={onSaveSettings}>
          <div className={styles.field}>
            <label htmlFor="mode">Mode</label>
            <select
              id="mode"
              onChange={(event) =>
                onSettingsChange({
                  ...embeddingSettings,
                  mode: event.target.value as EmbeddingMode,
                })
              }
              value={embeddingSettings.mode}
            >
              <option value="disabled">Disabled</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="ollama-url">Ollama base URL</label>
            <input
              disabled={isDisabled}
              id="ollama-url"
              onChange={(event) =>
                onSettingsChange({
                  ...embeddingSettings,
                  ollama_base_url: event.target.value,
                })
              }
              type="text"
              value={embeddingSettings.ollama_base_url}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="ollama-model">Ollama model</label>
            <input
              disabled={isDisabled}
              id="ollama-model"
              list="ollama-models"
              onChange={(event) =>
                onSettingsChange({
                  ...embeddingSettings,
                  ollama_model: event.target.value,
                })
              }
              type="text"
              value={embeddingSettings.ollama_model}
            />
            <datalist id="ollama-models">
              {(ollamaStatus?.models ?? []).map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>

          <dl className={styles.statusGrid}>
            <StatusCell label="Ollama installed" value={ollamaStatus?.installed ? 'Yes' : 'No'} />
            <StatusCell label="Ollama running" value={ollamaStatus?.running ? 'Yes' : 'No'} />
            <StatusCell label="Version" value={ollamaStatus?.version ?? '-'} />
            <StatusCell label="Models found" value={String(ollamaStatus?.models.length ?? 0)} />
          </dl>

          <button className={styles.primaryButton} disabled={isSavingSettings} type="submit">
            {isSavingSettings ? 'Saving' : 'Save settings'}
          </button>
          <MessageLine message={message} />
        </form>
      </section>
    </main>
  )
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statusCell}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
