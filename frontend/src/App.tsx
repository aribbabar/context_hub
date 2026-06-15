import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AppHeader } from './components/layout/AppHeader/AppHeader'
import { ConfirmationModal } from './components/ui/ConfirmationModal/ConfirmationModal'
import { LocalPathPickerModal } from './components/ui/LocalPathPickerModal/LocalPathPickerModal'
import { CapturePage } from './pages/CapturePage/CapturePage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'
import { SourcesPage } from './pages/SourcesPage/SourcesPage'
import { classNames } from './utils/classNames'
import type {
  DocsMcpDefaultsInstallResult,
  EmbeddingSettings,
  IndexJob,
  LocalPathEntry,
  LocalPathListResponse,
  LocalPathRootsResponse,
  Message,
  OllamaStatus,
  ParameterPayload,
  SearchResponse,
  SettingsResponse,
  SourceDeletionResponse,
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
  paths: [] as string[],
  name: '',
  version: 'latest',
}

const initialWebForm = {
  url: '',
  name: '',
  version: 'latest',
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
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
  const [isLocalPathPickerOpen, setIsLocalPathPickerOpen] = useState(false)
  const [localPathEntries, setLocalPathEntries] = useState<LocalPathEntry[]>([])
  const [localPathParent, setLocalPathParent] = useState<string | null>(null)
  const [localPathRoots, setLocalPathRoots] = useState<LocalPathEntry[]>([])
  const [localPathCurrent, setLocalPathCurrent] = useState('')
  const [pickerSelectedPaths, setPickerSelectedPaths] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [query, setQuery] = useState('')
  const [searchLimit, setSearchLimit] = useState(5)
  const [searchOutput, setSearchOutput] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null)
  const [sourceIdPendingDeletion, setSourceIdPendingDeletion] = useState<string | null>(null)
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
  const sourcePendingDeletion = useMemo(
    () => sources.find((source) => source.id === sourceIdPendingDeletion),
    [sourceIdPendingDeletion, sources],
  )

  const activeView = useMemo((): ViewName => {
    if (location.pathname.startsWith('/sources')) return 'sources'
    if (location.pathname.startsWith('/settings')) return 'settings'
    return 'capture'
  }, [location.pathname])

  const indexedSources = useMemo(
    () => sortedSources.filter((source) => source.status === 'indexed'),
    [sortedSources],
  )

  const refreshSources = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/sources`)
    if (!response.ok) {
      throw new Error('Unable to load sources')
    }

    const payload = (await response.json()) as SourcesResponse
    setSources(payload.sources)
    setJobs(payload.jobs)
    setSelectedSourceId((current) =>
      current && payload.sources.some((source) => source.id === current)
        ? current
        : payload.sources[0]?.id || '',
    )
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
    const localPaths = normalizePathList(localForm.paths)
    if (!localPaths.length) {
      setMessage({ text: 'Select at least one local folder or file', tone: 'error' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/local-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: localPaths,
          name: localForm.name || null,
          version: localForm.version,
          ...defaultPayload(10),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as SourceRegistrationResponse
      const job = await startIndexJobForSource(payload.source.id)
      setLocalForm(initialLocalForm)
      setSelectedSourceId(payload.source.id)
      setPickerSelectedPaths([])
      setActiveLogs('')
      setMessage({ text: `${payload.source.name} is indexing`, tone: 'success' })
      await refreshSources()
      await refreshJob(job.id)
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
      const job = await startIndexJobForSource(payload.source.id)
      setWebForm(initialWebForm)
      setSelectedSourceId(payload.source.id)
      setActiveLogs('')
      setMessage({ text: `${payload.source.name} is indexing`, tone: 'success' })
      await refreshSources()
      await refreshJob(job.id)
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
      setPickerSelectedPaths(localForm.paths)
      setIsLocalPathPickerOpen(true)
      await Promise.all([refreshLocalPathRoots(), browseLocalPath()])
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not open local path picker',
        tone: 'error',
      })
    } finally {
      setIsPickingFolder(false)
    }
  }

  async function refreshLocalPathRoots() {
    const response = await fetch(`${API_BASE_URL}/api/folders/roots`)
    if (!response.ok) {
      throw new Error('Unable to load local roots')
    }

    const payload = (await response.json()) as LocalPathRootsResponse
    setLocalPathRoots(payload.roots)
  }

  async function browseLocalPath(path?: string) {
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    const response = await fetch(`${API_BASE_URL}/api/folders/browse${query}`)
    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }

    const payload = (await response.json()) as LocalPathListResponse
    setLocalPathCurrent(payload.current_path)
    setLocalPathParent(payload.parent_path)
    setLocalPathEntries(payload.entries)
  }

  async function navigateLocalPath(path: string) {
    setIsPickingFolder(true)
    setMessage(null)

    try {
      await browseLocalPath(path)
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not open local path',
        tone: 'error',
      })
    } finally {
      setIsPickingFolder(false)
    }
  }

  function togglePickerPath(path: string) {
    setPickerSelectedPaths((current) =>
      current.includes(path)
        ? current.filter((selectedPath) => selectedPath !== path)
        : [...current, path],
    )
  }

  function applyPickerPaths() {
    setLocalForm((current) => ({
      ...current,
      paths: normalizePathList([...current.paths, ...pickerSelectedPaths]),
    }))
    setIsLocalPathPickerOpen(false)
  }

  function removeLocalPath(path: string) {
    setLocalForm((current) => ({
      ...current,
      paths: current.paths.filter((currentPath) => currentPath !== path),
    }))
    setPickerSelectedPaths((current) => current.filter((currentPath) => currentPath !== path))
  }

  async function startIndexJobForSource(sourceId: string) {
    const response = await fetch(`${API_BASE_URL}/api/sources/${sourceId}/index`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }

    const payload = (await response.json()) as { job: IndexJob }
    setJobs((current) => [payload.job, ...current.filter((job) => job.id !== payload.job.id)])
    return payload.job
  }

  function requestDeleteSource(sourceId: string) {
    const source = sources.find((currentSource) => currentSource.id === sourceId)
    if (!source) return
    setSourceIdPendingDeletion(sourceId)
  }

  function cancelDeleteSource() {
    if (deletingSourceId) return
    setSourceIdPendingDeletion(null)
  }

  async function confirmDeleteSource() {
    const sourceId = sourceIdPendingDeletion
    const source = sourcePendingDeletion
    if (!sourceId || !source) return
    setDeletingSourceId(sourceId)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/${sourceId}/delete`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const payload = (await response.json()) as SourceDeletionResponse
      const cleanupNote = payload.docs_mcp_removed
        ? ' and removed its docs-mcp index'
        : payload.docs_mcp_skipped
          ? ''
          : ', but docs-mcp cleanup did not complete'

      setSources((currentSources) => currentSources.filter((currentSource) => currentSource.id !== sourceId))
      setJobs((currentJobs) => currentJobs.filter((job) => job.source_id !== sourceId))
      setSelectedSourceId((current) => (current === sourceId ? '' : current))
      setActiveLogs('')
      setSearchOutput(null)
      setSourceIdPendingDeletion(null)
      setMessage({ text: `${source.name} deleted${cleanupNote}`, tone: 'success' })
      await refreshSources()
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Unable to delete source',
        tone: 'error',
      })
    } finally {
      setDeletingSourceId(null)
    }
  }

  async function searchDocs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const searchSource = indexedSources.find((source) => source.id === selectedSourceId) ?? indexedSources[0]
    if (!searchSource) return

    setIsSearching(true)
    setSearchOutput(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/sources/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: searchSource.id,
          query,
          limit: searchLimit,
          exact_match: false,
        }),
      })

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const payload = (await response.json()) as SearchResponse
      setSearchOutput(payload)
    } catch (error) {
      setSearchOutput({
        command: [],
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Search failed',
        results: null,
      })
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
      <AppHeader activeView={activeView} apiStatus={apiStatus} />

      <Routes>
        <Route index element={<Navigate replace to="/capture" />} />
        <Route
          path="/capture"
          element={
            <CapturePage
              activeLogs={activeLogs}
              latestJob={latestJob}
              selectedSource={selectedSource}
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
              onRemoveLocalPath={removeLocalPath}
              onRegisterLocal={registerLocalSource}
              onRegisterWeb={registerWebSource}
              onNavigate={(view) => navigate(`/${view}`)}
              onSelectSource={selectSource}
            />
          }
        />
        <Route
          path="/sources"
          element={
            <SourcesPage
              isSearching={isSearching}
              query={query}
              searchLimit={searchLimit}
              searchOutput={searchOutput}
              selectedSource={indexedSources.find((source) => source.id === selectedSourceId) ?? indexedSources[0]}
              sources={indexedSources}
              totalSourceCount={sources.length}
              deletingSourceId={deletingSourceId}
              message={message}
              onDeleteSource={requestDeleteSource}
              onQueryChange={setQuery}
              onRefreshSources={refreshSources}
              onSearchDocs={searchDocs}
              onSearchLimitChange={setSearchLimit}
              onSelectSource={selectSource}
            />
          }
        />
        <Route
          path="/settings"
          element={
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
          }
        />
        <Route path="*" element={<Navigate replace to="/capture" />} />
      </Routes>

      <ConfirmationModal
        confirmLabel="Delete source"
        isOpen={Boolean(sourcePendingDeletion)}
        isPending={Boolean(deletingSourceId)}
        message={
          sourcePendingDeletion
            ? `Delete ${sourcePendingDeletion.name} from Context Hub? This removes its registry entry, generated files, job logs, and indexed docs when no other source shares the same name and version.`
            : ''
        }
        title="Delete source"
        tone="danger"
        onCancel={cancelDeleteSource}
        onConfirm={confirmDeleteSource}
      />

      <LocalPathPickerModal
        currentPath={localPathCurrent}
        entries={localPathEntries}
        isLoading={isPickingFolder}
        isOpen={isLocalPathPickerOpen}
        parentPath={localPathParent}
        roots={localPathRoots}
        selectedPaths={pickerSelectedPaths}
        onApply={applyPickerPaths}
        onCancel={() => setIsLocalPathPickerOpen(false)}
        onNavigate={(path) => void navigateLocalPath(path)}
        onTogglePath={togglePickerPath}
      />
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

async function readErrorMessage(response: Response) {
  const text = await response.text()
  if (!text) return 'Request failed'

  try {
    const payload = JSON.parse(text) as { detail?: unknown }
    if (typeof payload.detail === 'string') return payload.detail
  } catch {
    return text
  }

  return text
}

function normalizePathList(paths: string[]) {
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)))
}

export default App
