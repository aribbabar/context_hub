import { useMemo, useState } from 'react'
import type {
  DocsMcpDefaultsInstallResult,
  EmbeddingMode,
  EmbeddingSettings,
  FormSubmitHandler,
  Message,
  OllamaStatus,
} from '../../types'
import { DropdownSelect } from '../../components/ui/DropdownSelect/DropdownSelect'
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

const embeddingModeOptions: Array<{
  value: EmbeddingMode
  label: string
  description: string
  tooltip: string
}> = [
  {
    value: 'disabled',
    label: 'Disabled',
    description: 'Use keyword search without embedding generation.',
    tooltip: 'Choose this when you do not want Context Hub to call a local embedding model.',
  },
  {
    value: 'ollama',
    label: 'Ollama',
    description: 'Use a local Ollama embedding model.',
    tooltip: 'Requires Ollama to be installed, running, and serving an embedding model.',
  },
]

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
  const [isModelSuggestionsOpen, setIsModelSuggestionsOpen] = useState(false)
  const modelSuggestions = useMemo(() => {
    const query = embeddingSettings.ollama_model.trim().toLowerCase()
    const models = ollamaStatus?.models ?? []
    if (!query) return models.slice(0, 8)

    return models
      .filter((model) => model.toLowerCase().includes(query))
      .slice(0, 8)
  }, [embeddingSettings.ollama_model, ollamaStatus?.models])
  const showModelSuggestions = !isDisabled && isModelSuggestionsOpen

  return (
    <main>
      <PageHeading title="Settings" text="Configure how indexed documentation is embedded and searched." />

      <section className={styles.settingsCard} aria-labelledby="settings-title">
        <h2 id="settings-title">Embedding model</h2>
        <form onSubmit={onSaveSettings}>
          <div className={styles.field}>
            <label htmlFor="mode">Mode</label>
            <DropdownSelect
              id="mode"
              label="Mode"
              onChange={(mode) =>
                onSettingsChange({
                  ...embeddingSettings,
                  mode,
                })
              }
              options={embeddingModeOptions}
              value={embeddingSettings.mode}
            />
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
            <div className={styles.autocomplete}>
              <input
                aria-autocomplete="list"
                aria-controls="ollama-model-suggestions"
                aria-expanded={showModelSuggestions}
                autoComplete="off"
                disabled={isDisabled}
                id="ollama-model"
                onBlur={() => setIsModelSuggestionsOpen(false)}
                onChange={(event) => {
                  setIsModelSuggestionsOpen(true)
                  onSettingsChange({
                    ...embeddingSettings,
                    ollama_model: event.target.value,
                  })
                }}
                onFocus={() => setIsModelSuggestionsOpen(true)}
                role="combobox"
                type="text"
                value={embeddingSettings.ollama_model}
              />
              {showModelSuggestions ? (
                <div className={styles.suggestions} id="ollama-model-suggestions" role="listbox">
                  {modelSuggestions.length ? (
                    modelSuggestions.map((model) => (
                      <button
                        className={model === embeddingSettings.ollama_model ? styles.suggestionActive : undefined}
                        key={model}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          onSettingsChange({
                            ...embeddingSettings,
                            ollama_model: model,
                          })
                          setIsModelSuggestionsOpen(false)
                        }}
                        role="option"
                        type="button"
                      >
                        {model}
                      </button>
                    ))
                  ) : (
                    <span className={styles.suggestionEmpty}>
                      {(ollamaStatus?.models.length ?? 0) > 0 ? 'No matching models' : 'No local models found'}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
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
