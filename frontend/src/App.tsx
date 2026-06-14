import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type SourceKind = 'local_folder' | 'web'
type SourceStatus = 'registered' | 'queued' | 'indexing' | 'indexed' | 'failed'
type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'
type EmbeddingMode = 'disabled' | 'ollama'

type SourceRecord = {
  id: string
  kind: SourceKind
  name: string
  version: string
  origin_location: string
  working_path: string | null
  docs_mcp_url: string | null
  metadata: Record<string, unknown>
  status: SourceStatus
  created_at: string
}

type IndexJob = {
  id: string
  source_id: string
  status: JobStatus
  progress: number
  command: string[]
  log_path: string
  error: string | null
  created_at: string
}

type SourcesResponse = {
  sources: SourceRecord[]
  jobs: IndexJob[]
}

type EmbeddingSettings = {
  mode: EmbeddingMode
  ollama_base_url: string
  ollama_model: string
}

type OllamaStatus = {
  installed: boolean
  running: boolean
  version: string | null
  models: string[]
  error: string | null
}

type SettingsResponse = {
  settings: {
    embeddings: EmbeddingSettings
  }
  ollama: OllamaStatus
}

type SourceRegistrationResponse = {
  source: SourceRecord
  command_preview: string[]
}

type SourceMode = 'local' | 'web'

type ParameterForm = {
  maxPages: number
  maxDepth: number
  maxConcurrency: number
  includePatterns: string
  excludePatterns: string
  scope: 'subpages' | 'hostname' | 'domain'
  scrapeMode: 'auto' | 'fetch' | 'playwright'
  preserveHashes: boolean
  followRedirects: boolean
  ignoreErrors: boolean
  clean: boolean
}

const defaultParameters: ParameterForm = {
  maxPages: 100,
  maxDepth: 2,
  maxConcurrency: 4,
  includePatterns: '',
  excludePatterns: '',
  scope: 'subpages',
  scrapeMode: 'auto',
  preserveHashes: false,
  followRedirects: true,
  ignoreErrors: true,
  clean: true,
}

const initialLocalForm = {
  path: '',
  name: '',
  version: 'latest',
}

const initialWebForm = {
  url: '',
  name: '',
  version: 'latest',
}

const defaultEmbeddingSettings: EmbeddingSettings = {
  mode: 'disabled',
  ollama_base_url: 'http://localhost:11434',
  ollama_model: 'nomic-embed-text',
}

function App() {
  const [mode, setMode] = useState<SourceMode>('local')
  const [localForm, setLocalForm] = useState(initialLocalForm)
  const [webForm, setWebForm] = useState(initialWebForm)
  const [parameters, setParameters] = useState(defaultParameters)
  const [sources, setSources] = useState<SourceRecord[]>([])
  const [jobs, setJobs] = useState<IndexJob[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [commandPreview, setCommandPreview] = useState<string[]>([])
  const [activeLogs, setActiveLogs] = useState('')
  const [embeddingSettings, setEmbeddingSettings] = useState(defaultEmbeddingSettings)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [isPickingFolder, setIsPickingFolder] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [searchLimit, setSearchLimit] = useState(5)
  const [searchOutput, setSearchOutput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? sources[0],
    [selectedSourceId, sources],
  )

  const latestJob = useMemo(() => {
    if (!selectedSource) return undefined
    return jobs
      .filter((job) => job.source_id === selectedSource.id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]
  }, [jobs, selectedSource])

  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    [sources],
  )

  const refreshSources = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/sources`)
    if (!response.ok) {
      throw new Error('Unable to load sources')
    }

    const payload = (await response.json()) as SourcesResponse
    setSources(payload.sources)
    setJobs(payload.jobs)
    setSelectedSourceId((current) => current || payload.sources[0]?.id || '')
  }, [])

  const refreshSettings = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/settings`)
    if (!response.ok) {
      throw new Error('Unable to load settings')
    }

    const payload = (await response.json()) as SettingsResponse
    setEmbeddingSettings(payload.settings.embeddings)
    setOllamaStatus(payload.ollama)
  }, [])

  const refreshJob = useCallback(async (jobId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sources/jobs/${jobId}`)
    if (!response.ok) return

    const payload = (await response.json()) as { job: IndexJob; logs: string }
    setJobs((current) => [payload.job, ...current.filter((job) => job.id !== payload.job.id)])
    setActiveLogs(payload.logs)
  }, [])

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId)
    const job = jobs
      .filter((currentJob) => currentJob.source_id === sourceId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]

    if (job) {
      void refreshJob(job.id)
    } else {
      setActiveLogs('')
    }
  }

  useEffect(() => {
    let isActive = true

    async function checkApi() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`)
        if (!isActive) return

        setApiStatus(response.ok ? 'online' : 'offline')
        if (response.ok) {
          await refreshSources()
          await refreshSettings()
        }
      } catch {
        if (isActive) {
          setApiStatus('offline')
        }
      }
    }

    void checkApi()

    return () => {
      isActive = false
    }
  }, [refreshSettings, refreshSources])

  useEffect(() => {
    if (!latestJob || latestJob.status === 'succeeded' || latestJob.status === 'failed') {
      return
    }

    const timer = window.setInterval(() => {
      void refreshSources()
      void refreshJob(latestJob.id)
    }, 1500)

    return () => window.clearInterval(timer)
  }, [latestJob, refreshJob, refreshSources])

  function requestPayload() {
    return {
      max_pages: parameters.maxPages,
      max_depth: parameters.maxDepth,
      max_concurrency: parameters.maxConcurrency,
      include_patterns: toLines(parameters.includePatterns),
      exclude_patterns: toLines(parameters.excludePatterns),
      scope: parameters.scope,
      scrape_mode: parameters.scrapeMode,
      preserve_hashes: parameters.preserveHashes,
      follow_redirects: parameters.followRedirects,
      ignore_errors: parameters.ignoreErrors,
      clean: parameters.clean,
    }
  }

  async function registerLocalSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/local-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: localForm.path,
          name: localForm.name || null,
          version: localForm.version,
          ...requestPayload(),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as SourceRegistrationResponse
      setCommandPreview(payload.command_preview)
      setLocalForm(initialLocalForm)
      setSelectedSourceId(payload.source.id)
      setMessage(`${payload.source.name} copied and registered`)
      await refreshSources()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Local source registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function registerWebSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webForm.url,
          name: webForm.name || null,
          version: webForm.version,
          ...requestPayload(),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as SourceRegistrationResponse
      setCommandPreview(payload.command_preview)
      setWebForm(initialWebForm)
      setSelectedSourceId(payload.source.id)
      setMessage(`${payload.source.name} registered`)
      await refreshSources()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Web source registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function pickFolder() {
    setIsPickingFolder(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/folders/pick`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Folder picker is unavailable')
      }

      const payload = (await response.json()) as { path: string | null }
      if (payload.path) {
        setLocalForm((current) => ({ ...current, path: payload.path ?? current.path }))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Folder picker is unavailable')
    } finally {
      setIsPickingFolder(false)
    }
  }

  async function startIndexing() {
    if (!selectedSource) return
    setMessage('')

    const response = await fetch(`${API_BASE_URL}/api/sources/${selectedSource.id}/index`, {
      method: 'POST',
    })
    if (!response.ok) {
      setMessage('Unable to start indexing')
      return
    }

    const payload = (await response.json()) as { job: IndexJob }
    setJobs((current) => [payload.job, ...current.filter((job) => job.id !== payload.job.id)])
    setCommandPreview(payload.job.command)
    setActiveLogs('')
    await refreshJob(payload.job.id)
  }

  async function searchDocs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedSource) return

    setIsSearching(true)
    setSearchOutput('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: selectedSource.id,
          query,
          limit: searchLimit,
          exact_match: false,
        }),
      })

      const payload = await response.json()
      setCommandPreview(payload.command ?? [])
      setSearchOutput(
        payload.results ? JSON.stringify(payload.results, null, 2) : payload.stdout || payload.stderr,
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function saveEmbeddingSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingSettings(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/embeddings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embeddingSettings),
      })

      if (!response.ok) {
        throw new Error('Unable to save embedding settings')
      }

      const payload = (await response.json()) as SettingsResponse
      setEmbeddingSettings(payload.settings.embeddings)
      setOllamaStatus(payload.ollama)
      setMessage('Embedding settings saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save embedding settings')
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Context Hub</p>
          <h1>Documentation source control</h1>
        </div>
        <div className={`connection connection--${apiStatus}`}>
          <span aria-hidden="true" />
          {apiStatus}
        </div>
      </header>

      <section className="settings-panel" aria-labelledby="settings-title">
        <div className="section-heading">
          <p className="eyebrow">Settings</p>
          <h2 id="settings-title">Embedding model</h2>
        </div>
        <form className="settings-form" onSubmit={saveEmbeddingSettings}>
          <label>
            <span>Mode</span>
            <select
              value={embeddingSettings.mode}
              onChange={(event) =>
                setEmbeddingSettings((current) => ({
                  ...current,
                  mode: event.target.value as EmbeddingMode,
                }))
              }
            >
              <option value="disabled">Disabled</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label>
            <span>Ollama URL</span>
            <input
              value={embeddingSettings.ollama_base_url}
              onChange={(event) =>
                setEmbeddingSettings((current) => ({
                  ...current,
                  ollama_base_url: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Ollama model</span>
            <input
              list="ollama-models"
              value={embeddingSettings.ollama_model}
              onChange={(event) =>
                setEmbeddingSettings((current) => ({
                  ...current,
                  ollama_model: event.target.value,
                }))
              }
            />
            <datalist id="ollama-models">
              {(ollamaStatus?.models ?? []).map((model) => (
                <option value={model} key={model} />
              ))}
            </datalist>
          </label>
          <button type="submit" className="secondary-action" disabled={isSavingSettings}>
            {isSavingSettings ? 'Saving' : 'Save settings'}
          </button>
        </form>
        <div className="settings-status">
          <mark>{embeddingSettings.mode}</mark>
          <span>Installed: {ollamaStatus?.installed ? 'yes' : 'no'}</span>
          <span>Running: {ollamaStatus?.running ? 'yes' : 'no'}</span>
          <span>Models: {ollamaStatus?.models.length ?? 0}</span>
        </div>
      </section>

      <section className="workspace" aria-label="Source registration workspace">
        <div className="source-panel">
          <div className="section-heading">
            <p className="eyebrow">Add source</p>
            <h2>Register docs for indexing</h2>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Source type">
            <button type="button" className={mode === 'local' ? 'active' : ''} onClick={() => setMode('local')}>
              Local folder
            </button>
            <button type="button" className={mode === 'web' ? 'active' : ''} onClick={() => setMode('web')}>
              Web docs
            </button>
          </div>

          {mode === 'local' ? (
            <form className="source-form" onSubmit={registerLocalSource}>
              <label>
                <span>Folder path</span>
                <div className="path-field">
                  <input
                    value={localForm.path}
                    onChange={(event) => setLocalForm((current) => ({ ...current, path: event.target.value }))}
                    placeholder="E:\Projects\docs"
                    required
                  />
                  <button type="button" onClick={pickFolder} disabled={isPickingFolder}>
                    {isPickingFolder ? 'Opening' : 'Browse'}
                  </button>
                </div>
              </label>
              <SourceIdentityFields
                name={localForm.name}
                version={localForm.version}
                onNameChange={(name) => setLocalForm((current) => ({ ...current, name }))}
                onVersionChange={(version) => setLocalForm((current) => ({ ...current, version }))}
              />
              <ParameterFields parameters={parameters} onChange={setParameters} />
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {isSubmitting ? 'Copying' : 'Copy and register'}
              </button>
            </form>
          ) : (
            <form className="source-form" onSubmit={registerWebSource}>
              <label>
                <span>Docs URL</span>
                <input
                  value={webForm.url}
                  onChange={(event) => setWebForm((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://docs.example.com"
                  required
                  type="url"
                />
              </label>
              <SourceIdentityFields
                name={webForm.name}
                version={webForm.version}
                onNameChange={(name) => setWebForm((current) => ({ ...current, name }))}
                onVersionChange={(version) => setWebForm((current) => ({ ...current, version }))}
              />
              <ParameterFields parameters={parameters} onChange={setParameters} />
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {isSubmitting ? 'Registering' : 'Register website'}
              </button>
            </form>
          )}

          {message ? <p className="form-message">{message}</p> : null}
        </div>

        <aside className="command-panel" aria-label="Command preview">
          <div className="section-heading">
            <p className="eyebrow">Backend handoff</p>
            <h2>Command preview</h2>
          </div>
          <pre>{commandPreview.length ? commandPreview.join(' ') : 'No command yet'}</pre>
        </aside>
      </section>

      <section className="source-list" aria-labelledby="source-list-title">
        <div className="list-header">
          <div className="section-heading">
            <p className="eyebrow">Registry</p>
            <h2 id="source-list-title">Existing docs</h2>
          </div>
          <button type="button" className="secondary-action" onClick={() => void refreshSources()}>
            Refresh
          </button>
        </div>

        <div className="source-table" role="table" aria-label="Registered sources">
          <div className="source-row source-row--head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Kind</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Original URL or folder</span>
          </div>
          {sortedSources.length ? (
            sortedSources.map((source) => (
              <button
                className={`source-row source-row--button ${selectedSource?.id === source.id ? 'selected' : ''}`}
                type="button"
                role="row"
                key={source.id}
                onClick={() => selectSource(source.id)}
              >
                <span role="cell">{source.name}</span>
                <span role="cell">{source.kind.replace('_', ' ')}</span>
                <span role="cell">{source.version}</span>
                <span role="cell">
                  <mark>{source.status}</mark>
                </span>
                <span role="cell" title={source.origin_location}>
                  {source.origin_location}
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state">No sources registered</div>
          )}
        </div>
      </section>

      <section className="detail-grid" aria-label="Selected source operations">
        <div className="detail-panel">
          <div className="section-heading">
            <p className="eyebrow">Selected source</p>
            <h2>{selectedSource?.name ?? 'No source selected'}</h2>
          </div>
          {selectedSource ? (
            <dl className="source-detail">
              <div>
                <dt>Original</dt>
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
          ) : null}
          <button type="button" className="primary-action" onClick={startIndexing} disabled={!selectedSource}>
            Run index job
          </button>
        </div>

        <div className="detail-panel">
          <div className="section-heading">
            <p className="eyebrow">Progress</p>
            <h2>{latestJob?.status ?? 'No job'}</h2>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${latestJob?.progress ?? 0}%` }} />
          </div>
          <p className="form-message">{latestJob ? `${latestJob.progress}% complete` : 'Start an index job to see progress'}</p>
        </div>
      </section>

      <section className="logs-search">
        <div className="logs-panel">
          <div className="section-heading">
            <p className="eyebrow">Logs</p>
            <h2>docs-mcp output</h2>
          </div>
          <pre>{activeLogs || 'No logs yet'}</pre>
        </div>

        <div className="search-panel">
          <div className="section-heading">
            <p className="eyebrow">Search</p>
            <h2>Query indexed docs</h2>
          </div>
          <form className="source-form" onSubmit={searchDocs}>
            <label>
              <span>Search query</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} required />
            </label>
            <label>
              <span>Limit</span>
              <input
                min="1"
                max="25"
                type="number"
                value={searchLimit}
                onChange={(event) => setSearchLimit(Number(event.target.value))}
              />
            </label>
            <button type="submit" className="primary-action" disabled={!selectedSource || isSearching}>
              {isSearching ? 'Searching' : 'Search docs'}
            </button>
          </form>
          <pre>{searchOutput || 'No search results yet'}</pre>
        </div>
      </section>
    </main>
  )
}

function SourceIdentityFields({
  name,
  version,
  onNameChange,
  onVersionChange,
}: {
  name: string
  version: string
  onNameChange: (value: string) => void
  onVersionChange: (value: string) => void
}) {
  return (
    <div className="form-grid">
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Library name" />
      </label>
      <label>
        <span>Version</span>
        <input value={version} onChange={(event) => onVersionChange(event.target.value)} required />
      </label>
    </div>
  )
}

function ParameterFields({
  parameters,
  onChange,
}: {
  parameters: ParameterForm
  onChange: (value: ParameterForm) => void
}) {
  return (
    <details className="parameter-panel" open>
      <summary>Scrape parameters</summary>
      <div className="parameter-grid">
        <label>
          <span>Max pages</span>
          <input
            min="1"
            type="number"
            value={parameters.maxPages}
            onChange={(event) => onChange({ ...parameters, maxPages: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>Depth</span>
          <input
            min="0"
            type="number"
            value={parameters.maxDepth}
            onChange={(event) => onChange({ ...parameters, maxDepth: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>Concurrency</span>
          <input
            min="1"
            type="number"
            value={parameters.maxConcurrency}
            onChange={(event) => onChange({ ...parameters, maxConcurrency: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>Scope</span>
          <select value={parameters.scope} onChange={(event) => onChange({ ...parameters, scope: event.target.value as ParameterForm['scope'] })}>
            <option value="subpages">Subpages</option>
            <option value="hostname">Hostname</option>
            <option value="domain">Domain</option>
          </select>
        </label>
        <label>
          <span>Scrape mode</span>
          <select
            value={parameters.scrapeMode}
            onChange={(event) => onChange({ ...parameters, scrapeMode: event.target.value as ParameterForm['scrapeMode'] })}
          >
            <option value="auto">Auto</option>
            <option value="fetch">Fetch</option>
            <option value="playwright">Playwright</option>
          </select>
        </label>
      </div>
      <div className="pattern-grid">
        <label>
          <span>Include patterns</span>
          <textarea
            value={parameters.includePatterns}
            onChange={(event) => onChange({ ...parameters, includePatterns: event.target.value })}
            placeholder="/docs/**"
          />
        </label>
        <label>
          <span>Exclude patterns</span>
          <textarea
            value={parameters.excludePatterns}
            onChange={(event) => onChange({ ...parameters, excludePatterns: event.target.value })}
            placeholder="**/changelog/**"
          />
        </label>
      </div>
      <div className="toggle-row">
        <label>
          <input
            checked={parameters.preserveHashes}
            onChange={(event) => onChange({ ...parameters, preserveHashes: event.target.checked })}
            type="checkbox"
          />
          <span>Preserve hashes</span>
        </label>
        <label>
          <input
            checked={parameters.followRedirects}
            onChange={(event) => onChange({ ...parameters, followRedirects: event.target.checked })}
            type="checkbox"
          />
          <span>Follow redirects</span>
        </label>
        <label>
          <input
            checked={parameters.ignoreErrors}
            onChange={(event) => onChange({ ...parameters, ignoreErrors: event.target.checked })}
            type="checkbox"
          />
          <span>Ignore errors</span>
        </label>
        <label>
          <input
            checked={parameters.clean}
            onChange={(event) => onChange({ ...parameters, clean: event.target.checked })}
            type="checkbox"
          />
          <span>Clean first</span>
        </label>
      </div>
    </details>
  )
}

function toLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export default App
