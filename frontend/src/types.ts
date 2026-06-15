import type { FormEvent } from 'react'

export type SourceKind = 'local_folder' | 'web'
export type SourceStatus = 'registered' | 'queued' | 'indexing' | 'indexed' | 'failed'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'
export type EmbeddingMode = 'disabled' | 'ollama'
export type SourceMode = 'local' | 'web'
export type ViewName = 'capture' | 'sources' | 'settings'
export type Message = { text: string; tone?: 'success' | 'error' } | null

export type LocalPathEntry = {
  name: string
  path: string
  is_dir: boolean
}

export type LocalPathListResponse = {
  current_path: string
  parent_path: string | null
  entries: LocalPathEntry[]
}

export type LocalPathRootsResponse = {
  roots: LocalPathEntry[]
}

export type SourceRecord = {
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

export type IndexJob = {
  id: string
  source_id: string
  status: JobStatus
  progress: number
  command: string[]
  log_path: string
  error: string | null
  created_at: string
}

export type SourcesResponse = {
  sources: SourceRecord[]
  jobs: IndexJob[]
}

export type SearchResponse = {
  command: string[]
  stdout: string
  stderr: string
  results: unknown
}

export type SourceDeletionResponse = {
  deleted_source: SourceRecord
  docs_mcp_command: string[] | null
  docs_mcp_stdout: string
  docs_mcp_stderr: string
  docs_mcp_removed: boolean
  docs_mcp_skipped: boolean
}

export type EmbeddingSettings = {
  mode: EmbeddingMode
  ollama_base_url: string
  ollama_model: string
}

export type OllamaStatus = {
  installed: boolean
  running: boolean
  version: string | null
  models: string[]
  error: string | null
}

export type SettingsResponse = {
  settings: {
    embeddings: EmbeddingSettings
  }
  ollama: OllamaStatus
}

export type DocsMcpDefaultsInstallResult = {
  config_path: string
  store_path: string
  embedding_model: string
  env_vars: Record<string, string>
  commands: string[][]
  restart_required: boolean
}

export type SourceRegistrationResponse = {
  source: SourceRecord
  command_preview: string[]
}

export type ParameterPayload = {
  max_pages: number
  max_depth: number
  max_concurrency: number
  include_patterns: string[]
  exclude_patterns: string[]
  scope: 'subpages' | 'hostname' | 'domain'
  scrape_mode: 'auto' | 'fetch' | 'playwright'
  preserve_hashes: boolean
  follow_redirects: boolean
  ignore_errors: boolean
  clean: boolean
}

export type FormSubmitHandler = (event: FormEvent<HTMLFormElement>) => void
