import type {
  DocsMcpDefaultsInstallResult,
  EmbeddingMode,
  EmbeddingSettings,
  FormSubmitHandler,
  Message,
  OllamaStatus,
} from '../../types'
import { MessageLine } from '../../components/ui/MessageLine/MessageLine'
import { PageHeading } from '../../components/ui/PageHeading/PageHeading'
import styles from './SettingsPage.module.css'

type SettingsPageProps = {
  docsMcpDefaults: DocsMcpDefaultsInstallResult | null
  embeddingSettings: EmbeddingSettings
  isInstallingDocsMcpDefaults: boolean
  isSavingSettings: boolean
  message: Message
  ollamaStatus: OllamaStatus | null
  onInstallDocsMcpDefaults: () => void
  onSaveSettings: FormSubmitHandler
  onSettingsChange: (settings: EmbeddingSettings) => void
}

export function SettingsPage({
  docsMcpDefaults,
  embeddingSettings,
  isInstallingDocsMcpDefaults,
  isSavingSettings,
  message,
  ollamaStatus,
  onInstallDocsMcpDefaults,
  onSaveSettings,
  onSettingsChange,
}: SettingsPageProps) {
  const isDisabled = embeddingSettings.mode === 'disabled'
  const canInstallDocsMcpDefaults = embeddingSettings.mode === 'ollama'

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

      <section className={styles.settingsCard} aria-labelledby="docs-mcp-defaults-title">
        <h2 id="docs-mcp-defaults-title">Agent search defaults</h2>
        <p className={styles.cardText}>
          Configure bare docs-mcp commands to use this Context Hub store and the selected Ollama embedding model.
        </p>

        <dl className={styles.defaultGrid}>
          <StatusCell label="Store path" value="Context Hub docs-mcp store" />
          <StatusCell
            label="Embedding model"
            value={canInstallDocsMcpDefaults ? `openai:${embeddingSettings.ollama_model}` : 'Enable Ollama first'}
          />
          <StatusCell
            label="OpenAI-compatible URL"
            value={canInstallDocsMcpDefaults ? `${embeddingSettings.ollama_base_url.replace(/\/$/, '')}/v1` : '-'}
          />
        </dl>

        <button
          className={styles.secondaryButton}
          disabled={!canInstallDocsMcpDefaults || isInstallingDocsMcpDefaults}
          onClick={onInstallDocsMcpDefaults}
          type="button"
        >
          {isInstallingDocsMcpDefaults ? 'Configuring' : 'Configure docs-mcp defaults'}
        </button>

        {docsMcpDefaults ? (
          <div className={styles.installSummary} aria-live="polite">
            <dl>
              <SummaryRow label="Config" value={docsMcpDefaults.config_path} />
              <SummaryRow label="Store" value={docsMcpDefaults.store_path} />
              <SummaryRow label="Model" value={docsMcpDefaults.embedding_model} />
            </dl>
            <p>Restart terminals and agent sessions before expecting new bare docs-mcp commands to inherit the environment.</p>
          </div>
        ) : null}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
