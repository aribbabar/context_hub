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
  CrawlScope,
  LocalPathEntry,
  LocalPathListResponse,
  LocalPathRootsResponse,
  Message,
  OllamaStatus,
  ParameterPayload,
  ScrapeMode,
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

const WEB_CRAWL_PREFERENCES_STORAGE_KEY = 'context-hub:web-crawl-preferences'
const DEFAULT_WEB_INCLUDE_PATTERNS = '/docs/*'
const DEFAULT_WEB_EXCLUDE_PATTERNS = [
  '**/CHANGELOG.md',
  '**/changelog.md',
  '**/CHANGELOG.mdx',
  '**/changelog.mdx',
  '**/LICENSE',
  '**/LICENSE.md',
  '**/license.md',
  '**/CODE_OF_CONDUCT.md',
  '**/code_of_conduct.md',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*_test.py',
  '**/*_test.go',
  '**/*.lock',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/go.sum',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/*.d.ts',
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/*.swp',
  '**/*.swo',
  '/.*\\.(ini|cfg|conf|log|pid)$/',
  '**/archive/**',
  '**/archived/**',
  '**/deprecated/**',
  '**/legacy/**',
  '**/old/**',
  '**/outdated/**',
  '**/previous/**',
  '**/superseded/**',
  'docs/old/**',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/spec/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/target/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/i18n/ar*/**',
  '**/i18n/de*/**',
  '**/i18n/es*/**',
  '**/i18n/fr*/**',
  '**/i18n/hi*/**',
  '**/i18n/it*/**',
  '**/i18n/ja*/**',
  '**/i18n/ko*/**',
  '**/i18n/nl*/**',
  '**/i18n/pl*/**',
  '**/i18n/pt*/**',
  '**/i18n/ru*/**',
  '**/i18n/sv*/**',
  '**/i18n/th*/**',
  '**/i18n/tr*/**',
  '**/i18n/vi*/**',
  '**/i18n/zh*/**',
  '**/zh-cn/**',
  '**/zh-hk/**',
  '**/zh-mo/**',
  '**/zh-sg/**',
  '**/zh-tw/**',
].join('\n')

type WebCrawlPreferences = {
  maxPages: number
  maxDepth: number
  maxConcurrency: number
  includePatterns: string
  excludePatterns: string
  scope: CrawlScope
  scrapeMode: ScrapeMode
  preserveHashes: boolean
  followRedirects: boolean
  ignoreErrors: boolean
  clean: boolean
}

const defaultWebCrawlPreferences: WebCrawlPreferences = {
  maxPages: 1000,
  maxDepth: 3,
  maxConcurrency: 4,
  includePatterns: DEFAULT_WEB_INCLUDE_PATTERNS,
  excludePatterns: DEFAULT_WEB_EXCLUDE_PATTERNS,
  scope: 'hostname',
  scrapeMode: 'auto',
  preserveHashes: false,
  followRedirects: true,
  ignoreErrors: true,
  clean: true,
}

type WebFormState = {
  url: string
  name: string
  version: string
} & WebCrawlPreferences

const initialWebForm: WebFormState = {
  url: '',
  name: '',
  version: 'latest',
  ...defaultWebCrawlPreferences,
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<SourceMode>('local')
  const [localForm, setLocalForm] = useState(initialLocalForm)
  const [webForm, setWebForm] = useState<WebFormState>(() => ({
    ...initialWebForm,
    ...readStoredWebCrawlPreferences(),
  }))
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

  useEffect(() => {
    writeStoredWebCrawlPreferences(webForm)
  }, [webForm])

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
          ...webParameterPayload(webForm),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as SourceRegistrationResponse
      const job = await startIndexJobForSource(payload.source.id)
      setWebForm((current) => ({ ...current, url: '', name: '', version: 'latest' }))
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

  function resetWebCrawlPreferences() {
    setWebForm((current) => ({
      ...current,
      ...defaultWebCrawlPreferences,
    }))
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
              onResetWebPreferences={resetWebCrawlPreferences}
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
    headers: {},
    preserve_hashes: false,
    follow_redirects: true,
    ignore_errors: true,
    clean: true,
  }
}

function webParameterPayload(form: WebFormState): ParameterPayload {
  return {
    max_pages: form.maxPages,
    max_depth: form.maxDepth,
    max_concurrency: form.maxConcurrency,
    include_patterns: parseLines(form.includePatterns),
    exclude_patterns: parseLines(form.excludePatterns),
    scope: form.scope,
    scrape_mode: form.scrapeMode,
    headers: {},
    preserve_hashes: form.preserveHashes,
    follow_redirects: form.followRedirects,
    ignore_errors: form.ignoreErrors,
    clean: form.clean,
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

function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function readStoredWebCrawlPreferences(): Partial<WebCrawlPreferences> {
  if (typeof window === 'undefined') return {}

  try {
    const storedValue = window.localStorage.getItem(WEB_CRAWL_PREFERENCES_STORAGE_KEY)
    if (!storedValue) return {}
    return sanitizeWebCrawlPreferences(JSON.parse(storedValue))
  } catch {
    return {}
  }
}

function writeStoredWebCrawlPreferences(form: WebCrawlPreferences) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    WEB_CRAWL_PREFERENCES_STORAGE_KEY,
    JSON.stringify({
      maxPages: form.maxPages,
      maxDepth: form.maxDepth,
      maxConcurrency: form.maxConcurrency,
      includePatterns: form.includePatterns,
      excludePatterns: form.excludePatterns,
      scope: form.scope,
      scrapeMode: form.scrapeMode,
      preserveHashes: form.preserveHashes,
      followRedirects: form.followRedirects,
      ignoreErrors: form.ignoreErrors,
      clean: form.clean,
    }),
  )
}

function sanitizeWebCrawlPreferences(value: unknown): Partial<WebCrawlPreferences> {
  if (!value || typeof value !== 'object') return {}
  const stored = value as Partial<WebCrawlPreferences>
  const preferences: Partial<WebCrawlPreferences> = {}

  if (typeof stored.maxPages === 'number') preferences.maxPages = clampNumber(stored.maxPages, 1, 1000)
  if (typeof stored.maxDepth === 'number') preferences.maxDepth = clampNumber(stored.maxDepth, 0, 10)
  if (typeof stored.maxConcurrency === 'number') {
    preferences.maxConcurrency = clampNumber(stored.maxConcurrency, 1, 32)
  }
  if (typeof stored.includePatterns === 'string') preferences.includePatterns = stored.includePatterns
  if (typeof stored.excludePatterns === 'string') preferences.excludePatterns = stored.excludePatterns
  if (stored.scope === 'subpages' || stored.scope === 'hostname' || stored.scope === 'domain') {
    preferences.scope = stored.scope
  }
  if (stored.scrapeMode === 'auto' || stored.scrapeMode === 'fetch' || stored.scrapeMode === 'playwright') {
    preferences.scrapeMode = stored.scrapeMode
  }
  if (typeof stored.preserveHashes === 'boolean') preferences.preserveHashes = stored.preserveHashes
  if (typeof stored.followRedirects === 'boolean') preferences.followRedirects = stored.followRedirects
  if (typeof stored.ignoreErrors === 'boolean') preferences.ignoreErrors = stored.ignoreErrors
  if (typeof stored.clean === 'boolean') preferences.clean = stored.clean

  return preferences
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max)
}

export default App
