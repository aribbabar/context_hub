import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AppHeader } from './components/layout/AppHeader/AppHeader'
import { CapturePage } from './pages/CapturePage/CapturePage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'
import { SourcesPage } from './pages/SourcesPage/SourcesPage'
import { classNames } from './utils/classNames'
import type {
  DocsMcpDefaultsInstallResult,
  EmbeddingSettings,
  IndexJob,
  Message,
  OllamaStatus,
  ParameterPayload,
  SettingsResponse,
  SourceMode,
  SourceRecord,
  SourceRegistrationResponse,
  SourcesResponse,
  ViewName,
} from './types'
import styles from './App.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const defaultEmbeddingSettings: EmbeddingSettings = {
  mode: 'disabled',
  ollama_base_url: 'http://localhost:11434',
  ollama_model: 'nomic-embed-text',
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

function App() {
  const [activeView, setActiveView] = useState<ViewName>('capture')
  const [mode, setMode] = useState<SourceMode>('local')
  const [localForm, setLocalForm] = useState(initialLocalForm)
  const [webForm, setWebForm] = useState(initialWebForm)
  const [sources, setSources] = useState<SourceRecord[]>([])
  const [jobs, setJobs] = useState<IndexJob[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [activeLogs, setActiveLogs] = useState('')
  const [embeddingSettings, setEmbeddingSettings] = useState(defaultEmbeddingSettings)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [isPickingFolder, setIsPickingFolder] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [query, setQuery] = useState('')
  const [searchLimit, setSearchLimit] = useState(5)
  const [searchOutput, setSearchOutput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isInstallingDocsMcpDefaults, setIsInstallingDocsMcpDefaults] = useState(false)
  const [docsMcpDefaults, setDocsMcpDefaults] = useState<DocsMcpDefaultsInstallResult | null>(null)

  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    [sources],
  )

  const selectedSource = useMemo(
    () =>
      sources.find((source) => source.id === selectedSourceId) ??
      sortedSources[0],
    [selectedSourceId, sortedSources, sources],
  )

  const latestJob = useMemo(() => {
    if (!selectedSource) return undefined

    return jobs
      .filter((job) => job.source_id === selectedSource.id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]
  }, [jobs, selectedSource])

  const recentSources = sortedSources.slice(0, 5)

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

  async function registerLocalSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/local-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: localForm.path,
          name: localForm.name || null,
          version: localForm.version,
          ...defaultPayload(10),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as SourceRegistrationResponse
      setLocalForm(initialLocalForm)
      setSelectedSourceId(payload.source.id)
      setMessage({ text: `${payload.source.name} registered`, tone: 'success' })
      await refreshSources()
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Local source registration failed',
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function registerWebSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webForm.url,
          name: webForm.name || null,
          version: webForm.version,
          ...defaultPayload(2),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as SourceRegistrationResponse
      setWebForm(initialWebForm)
      setSelectedSourceId(payload.source.id)
      setMessage({ text: `${payload.source.name} registered`, tone: 'success' })
      await refreshSources()
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Web source registration failed',
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function pickFolder() {
    setIsPickingFolder(true)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/folders/pick`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Folder picker unavailable')
      }

      const payload = (await response.json()) as { path: string | null }
      if (payload.path) {
        setLocalForm((current) => ({ ...current, path: payload.path ?? current.path }))
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not open folder picker',
        tone: 'error',
      })
    } finally {
      setIsPickingFolder(false)
    }
  }

  async function startIndexing() {
    if (!selectedSource) return
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/${selectedSource.id}/index`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Unable to start indexing')
      }

      const payload = (await response.json()) as { job: IndexJob }
      setJobs((current) => [payload.job, ...current.filter((job) => job.id !== payload.job.id)])
      setActiveLogs('')
      await refreshJob(payload.job.id)
    } catch (error) {
      setActiveLogs(error instanceof Error ? error.message : 'Unable to start indexing')
    }
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
      setSearchOutput(
        payload.results ? JSON.stringify(payload.results, null, 2) : payload.stdout || payload.stderr || 'No results.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function saveEmbeddingSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingSettings(true)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/embeddings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embeddingSettings),
      })

      if (!response.ok) {
        throw new Error('Unable to save settings')
      }

      const payload = (await response.json()) as SettingsResponse
      setEmbeddingSettings(payload.settings.embeddings)
      setOllamaStatus(payload.ollama)
      setMessage({ text: 'Embedding settings saved', tone: 'success' })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to save settings',
        tone: 'error',
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function installDocsMcpDefaults() {
    setIsInstallingDocsMcpDefaults(true)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/docs-mcp-defaults`, {
        method: 'POST',
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || 'Unable to configure docs-mcp defaults')
      }

      const payload = (await response.json()) as DocsMcpDefaultsInstallResult
      setDocsMcpDefaults(payload)
      setMessage({ text: 'docs-mcp defaults configured', tone: 'success' })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to configure docs-mcp defaults',
        tone: 'error',
      })
    } finally {
      setIsInstallingDocsMcpDefaults(false)
    }
  }

  return (
    <div className={classNames(styles.appShell, activeView === 'settings' && styles.appShellSettings)}>
      <AppHeader activeView={activeView} apiStatus={apiStatus} onNavigate={setActiveView} />

      {activeView === 'capture' ? (
        <CapturePage
          mode={mode}
          message={message}
          recentSources={recentSources}
          localForm={localForm}
          webForm={webForm}
          isPickingFolder={isPickingFolder}
          isSubmitting={isSubmitting}
          onModeChange={setMode}
          onLocalFormChange={setLocalForm}
          onWebFormChange={setWebForm}
          onPickFolder={pickFolder}
          onRegisterLocal={registerLocalSource}
          onRegisterWeb={registerWebSource}
          onNavigate={setActiveView}
          onSelectSource={selectSource}
        />
      ) : null}

      {activeView === 'sources' ? (
        <SourcesPage
          activeLogs={activeLogs}
          isSearching={isSearching}
          latestJob={latestJob}
          query={query}
          searchLimit={searchLimit}
          searchOutput={searchOutput}
          selectedSource={selectedSource}
          sources={sortedSources}
          onQueryChange={setQuery}
          onRefreshSources={refreshSources}
          onSearchDocs={searchDocs}
          onSearchLimitChange={setSearchLimit}
          onSelectSource={selectSource}
          onStartIndexing={startIndexing}
        />
      ) : null}

      {activeView === 'settings' ? (
        <SettingsPage
          docsMcpDefaults={docsMcpDefaults}
          embeddingSettings={embeddingSettings}
          isInstallingDocsMcpDefaults={isInstallingDocsMcpDefaults}
          isSavingSettings={isSavingSettings}
          message={message}
          ollamaStatus={ollamaStatus}
          onInstallDocsMcpDefaults={installDocsMcpDefaults}
          onSaveSettings={saveEmbeddingSettings}
          onSettingsChange={setEmbeddingSettings}
        />
      ) : null}
    </div>
  )
}

function defaultPayload(depth: number): ParameterPayload {
  return {
    max_pages: 100,
    max_depth: depth,
    max_concurrency: 4,
    include_patterns: [],
    exclude_patterns: [],
    scope: 'subpages',
    scrape_mode: 'auto',
    preserve_hashes: false,
    follow_redirects: true,
    ignore_errors: true,
    clean: true,
  }
}

export default App
