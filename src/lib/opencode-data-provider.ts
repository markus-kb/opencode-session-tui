/**
 * Data Provider Abstraction for opencode data access.
 *
 * This module provides a unified interface for accessing opencode session/project data
 * from either the JSONL file-based storage or SQLite database backend.
 *
 * Provider pattern notes:
 * - The DataProvider interface is the contract for all backends.
 * - To add a new backend, implement its loader/writer functions, add a new
 *   StorageBackend value, and wire a createXProvider() branch in createProvider().
 * - Keep behavior consistent with JSONL defaults (ordering, filters, error handling).
 *
 * Usage:
 * ```ts
 * // Create provider based on options
 * const provider = createProvider({ backend: 'sqlite', dbPath: '/path/to/db' })
 *
 * // Use the same interface regardless of backend
 * const projects = await provider.loadProjectRecords()
 * const sessions = await provider.loadSessionRecords({ projectId: 'abc123' })
 * ```
 */
import { join, resolve } from "node:path"
import { existsSync } from "node:fs"
import { Database } from "bun:sqlite"
import type {
  ProjectRecord,
  SessionRecord,
  ChatMessage,
  ChatPart,
  DeleteResult,
  DeleteOptions,
  TokenSummary,
  AggregateTokenSummary,
  ChatSearchResult,
} from "./opencode-data"
import {
  DEFAULT_ROOT,
  loadProjectRecords,
  loadSessionRecords,
  loadSessionChatIndex,
  loadMessageParts,
  hydrateChatMessageParts,
  deleteProjectMetadata,
  deleteSessionMetadata,
  updateSessionTitle,
  moveSession,
  copySession,
  computeSessionTokenSummary,
  computeProjectTokenSummary,
  computeGlobalTokenSummary,
  searchSessionsChat,
} from "./opencode-data"
import {
  DEFAULT_SQLITE_PATH,
  openDatabase,
  loadProjectRecordsSqlite,
  loadSessionRecordsSqlite,
  loadSessionChatIndexSqlite,
  loadMessagePartsSqlite,
  computeTokenSummariesSqlite,
  deleteSessionMetadataSqlite,
  deleteProjectMetadataSqlite,
  updateSessionTitleSqlite,
  moveSessionSqlite,
  copySessionSqlite,
} from "./opencode-data-sqlite"

// ========================
// Types
// ========================

/**
 * Storage backend type.
 */
export type StorageBackend = "jsonl" | "sqlite" | "hybrid"

/**
 * Options for the provider factory.
 */
export interface DataProviderOptions {
  /**
   * Storage backend to use.
   * When omitted, auto-detects: SQLite if opencode.db exists, else JSONL.
   */
  backend?: StorageBackend

  /**
   * Root directory for JSONL storage.
   * Required when backend is "jsonl".
   * Defaults to DEFAULT_ROOT (~/.local/share/opencode).
   */
  root?: string

  /**
   * Path to SQLite database file.
   * Required when backend is "sqlite".
   * Defaults to DEFAULT_SQLITE_PATH (~/.local/share/opencode/opencode.db).
   */
  dbPath?: string

  /**
   * Fail fast on any SQLite error or malformed data.
   * Only applies when backend is "sqlite".
   */
  sqliteStrict?: boolean

  /**
   * Wait for SQLite write locks to clear before failing.
   * Only applies when backend is "sqlite".
   */
  forceWrite?: boolean

  /**
   * Optional warning sink for SQLite warnings.
   */
  onWarning?: (warning: string) => void
}

/**
 * Options for loading sessions.
 */
export interface SessionLoadOptions {
  projectId?: string
}

/**
 * Unified data provider interface for both storage backends.
 *
 * This interface mirrors the existing JSONL loader functions but allows
 * transparent switching between backends.
 */
export interface DataProvider {
  /**
   * The storage backend being used.
   */
  readonly backend: StorageBackend

  /**
   * Optional disposal hook for releasing resources (e.g. persistent DB connections).
   * Should be called when the provider is no longer needed.
   */
  dispose?(): void

  /**
   * Load all project records.
   */
  loadProjectRecords(): Promise<ProjectRecord[]>

  /**
   * Load session records, optionally filtered by project.
   */
  loadSessionRecords(options?: SessionLoadOptions): Promise<SessionRecord[]>

  /**
   * Load chat message index for a session (metadata only, no parts).
   */
  loadSessionChatIndex(sessionId: string): Promise<ChatMessage[]>

  /**
   * Load all parts for a message.
   */
  loadMessageParts(messageId: string): Promise<ChatPart[]>

  /**
   * Hydrate a chat message with its parts.
   */
  hydrateChatMessageParts(message: ChatMessage): Promise<ChatMessage>

  /**
   * Delete project metadata files/records.
   */
  deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions): Promise<DeleteResult>

  /**
   * Delete session metadata files/records.
   */
  deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions): Promise<DeleteResult>

  /**
   * Update session title.
   */
  updateSessionTitle(session: SessionRecord, newTitle: string): Promise<void>

  /**
   * Move a session to another project.
   */
  moveSession(session: SessionRecord, targetProjectId: string): Promise<SessionRecord>

  /**
   * Copy a session to another project.
   */
  copySession(session: SessionRecord, targetProjectId: string): Promise<SessionRecord>

  /**
   * Compute token summary for a single session.
   */
  computeSessionTokenSummary(session: SessionRecord): Promise<TokenSummary>

  /**
   * Compute aggregate token summary for a project.
   */
  computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]): Promise<AggregateTokenSummary>

  /**
   * Compute aggregate token summary for all sessions.
   */
  computeGlobalTokenSummary(sessions: SessionRecord[]): Promise<AggregateTokenSummary>

  /**
   * Search chat content across sessions.
   */
  searchSessionsChat(
    sessions: SessionRecord[],
    query: string,
    options?: { maxResults?: number }
  ): Promise<ChatSearchResult[]>
}

// ========================
// JSONL Provider Implementation
// ========================

/**
 * Create a JSONL-backed data provider.
 */
function createJsonlProvider(root: string): DataProvider {
  const normalizedRoot = resolve(root)

  return {
    backend: "jsonl",

    async loadProjectRecords() {
      return loadProjectRecords({ root: normalizedRoot })
    },

    async loadSessionRecords(options?: SessionLoadOptions) {
      return loadSessionRecords({ root: normalizedRoot, projectId: options?.projectId })
    },

    async loadSessionChatIndex(sessionId: string) {
      return loadSessionChatIndex(sessionId, normalizedRoot)
    },

    async loadMessageParts(messageId: string) {
      return loadMessageParts(messageId, normalizedRoot)
    },

    async hydrateChatMessageParts(message: ChatMessage) {
      return hydrateChatMessageParts(message, normalizedRoot)
    },

    async deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions) {
      return deleteProjectMetadata(records, options)
    },

    async deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions) {
      return deleteSessionMetadata(records, options)
    },

    async updateSessionTitle(session: SessionRecord, newTitle: string) {
      return updateSessionTitle(session.filePath, newTitle)
    },

    async moveSession(session: SessionRecord, targetProjectId: string) {
      return moveSession(session, targetProjectId, normalizedRoot)
    },

    async copySession(session: SessionRecord, targetProjectId: string) {
      return copySession(session, targetProjectId, normalizedRoot)
    },

    async computeSessionTokenSummary(session: SessionRecord) {
      return computeSessionTokenSummary(session, normalizedRoot)
    },

    async computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]) {
      return computeProjectTokenSummary(projectId, sessions, normalizedRoot)
    },

    async computeGlobalTokenSummary(sessions: SessionRecord[]) {
      return computeGlobalTokenSummary(sessions, normalizedRoot)
    },

    async searchSessionsChat(
      sessions: SessionRecord[],
      query: string,
      options?: { maxResults?: number }
    ) {
      return searchSessionsChat(sessions, query, normalizedRoot, options)
    },
  }
}

// ========================
// SQLite Provider Implementation
// ========================

/**
 * Hydrate a chat message with its parts (SQLite version).
 */
async function hydrateChatMessagePartsSqlite(
  message: ChatMessage,
  db: Database,
  options?: { strict?: boolean; onWarning?: (warning: string) => void }
): Promise<ChatMessage> {
  const parts = await loadMessagePartsSqlite({
    db,
    messageId: message.messageId,
    strict: options?.strict,
    onWarning: options?.onWarning,
  })

  // Combine all part texts for total chars and preview
  const combinedText = parts.map((p) => p.text).join("\n\n")
  const totalChars = combinedText.length

  const PREVIEW_CHARS = 200
  let previewText: string
  if (combinedText.length === 0) {
    previewText = "[no content]"
  } else if (combinedText.length <= PREVIEW_CHARS) {
    previewText = combinedText.replace(/\n/g, " ").trim()
  } else {
    previewText = combinedText.slice(0, PREVIEW_CHARS).replace(/\n/g, " ").trim() + "..."
  }

  return {
    ...message,
    parts,
    previewText,
    totalChars,
  }
}

/**
 * Create a SQLite-backed data provider.
 *
 * Opens a persistent readonly Database connection for read operations.
 * Write operations open their own short-lived connections to avoid
 * read/write locking contention.
 */
function createSqliteProvider(
  dbPath: string,
  options?: { strict?: boolean; forceWrite?: boolean; onWarning?: (warning: string) => void }
): DataProvider {
  const normalizedDbPath = resolve(dbPath)
  // Persistent readonly connection for all read operations.
  const db = openDatabase(normalizedDbPath, { readonly: true })

  const readOptions = {
    db,
    strict: options?.strict,
    onWarning: options?.onWarning,
  }
  const writeOptions = {
    db: normalizedDbPath,
    strict: options?.strict,
    onWarning: options?.onWarning,
    forceWrite: options?.forceWrite,
  }

  return {
    backend: "sqlite",

    dispose() {
      db.close()
    },

    async loadProjectRecords() {
      return loadProjectRecordsSqlite(readOptions)
    },

    async loadSessionRecords(options?: SessionLoadOptions) {
      return loadSessionRecordsSqlite({ ...readOptions, projectId: options?.projectId })
    },

    async loadSessionChatIndex(sessionId: string) {
      return loadSessionChatIndexSqlite({ ...readOptions, sessionId })
    },

    async loadMessageParts(messageId: string) {
      return loadMessagePartsSqlite({ ...readOptions, messageId })
    },

    async hydrateChatMessageParts(message: ChatMessage) {
      return hydrateChatMessagePartsSqlite(message, db, readOptions)
    },

    // Write operations open their own connection so they don't contend
    // with the persistent readonly handle.

    async deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions) {
      const projectIds = records.map(r => r.projectId)
      return deleteProjectMetadataSqlite(projectIds, {
        ...writeOptions,
        dryRun: options?.dryRun,
      })
    },

    async deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions) {
      const sessionIds = records.map(r => r.sessionId)
      return deleteSessionMetadataSqlite(sessionIds, {
        ...writeOptions,
        dryRun: options?.dryRun,
      })
    },

    async updateSessionTitle(session: SessionRecord, newTitle: string) {
      return updateSessionTitleSqlite({
        ...writeOptions,
        sessionId: session.sessionId,
        newTitle,
      })
    },

    async moveSession(session: SessionRecord, targetProjectId: string) {
      return moveSessionSqlite({
        ...writeOptions,
        sessionId: session.sessionId,
        targetProjectId,
      })
    },

    async copySession(session: SessionRecord, targetProjectId: string) {
      return copySessionSqlite({
        ...writeOptions,
        sessionId: session.sessionId,
        targetProjectId,
      })
    },

    // Token computation: batch-aggregate via single SQL query instead of N+1
    async computeSessionTokenSummary(session: SessionRecord) {
      const summaries = await computeTokenSummariesSqlite(readOptions)
      return summaries.get(session.sessionId) ?? { kind: "unknown", reason: "no_messages" } as const
    },

    async computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]) {
      const summaries = await computeTokenSummariesSqlite(readOptions)
      const projectSessions = sessions.filter((s) => s.projectId === projectId)
      return aggregateFromSummaries(projectSessions, summaries)
    },

    async computeGlobalTokenSummary(sessions: SessionRecord[]) {
      const summaries = await computeTokenSummariesSqlite(readOptions)
      return aggregateFromSummaries(sessions, summaries)
    },

    // Search: Use SQLite data loading but same search logic
    async searchSessionsChat(
      sessions: SessionRecord[],
      query: string,
      options?: { maxResults?: number }
    ) {
      const queryLower = query.toLowerCase().trim()
      const maxResults = options?.maxResults ?? 100
      const results: ChatSearchResult[] = []

      if (!queryLower) {
        return results
      }

      for (const session of sessions) {
        if (results.length >= maxResults) break

        // Load messages for this session
        const messages = await loadSessionChatIndexSqlite({
          ...readOptions,
          sessionId: session.sessionId,
        })

        for (const message of messages) {
          if (results.length >= maxResults) break

          // Load parts to search content
          const parts = await loadMessagePartsSqlite({
            ...readOptions,
            messageId: message.messageId,
          })

          for (const part of parts) {
            if (results.length >= maxResults) break

            const textLower = part.text.toLowerCase()
            const matchIndex = textLower.indexOf(queryLower)

            if (matchIndex !== -1) {
              // Create a snippet around the match
              const snippetStart = Math.max(0, matchIndex - 50)
              const snippetEnd = Math.min(part.text.length, matchIndex + query.length + 50)
              let snippet = part.text.slice(snippetStart, snippetEnd)
              if (snippetStart > 0) snippet = "..." + snippet
              if (snippetEnd < part.text.length) snippet = snippet + "..."

              results.push({
                sessionId: session.sessionId,
                sessionTitle: session.title || session.sessionId,
                projectId: session.projectId,
                messageId: message.messageId,
                role: message.role,
                matchedText: snippet.replace(/\n/g, " "),
                fullText: part.text,
                partType: part.type,
                createdAt: message.createdAt,
              })

              // Only one result per message to avoid duplicates
              break
            }
          }
        }
      }

      return results
    },
  }
}

function isSqliteRecord(record: { filePath: string }): boolean {
  return record.filePath.startsWith("sqlite:")
}

function reindex<T extends { index: number }>(records: T[]): T[] {
  return records.map((record, idx) => ({ ...record, index: idx + 1 }))
}

function compareSessions(a: SessionRecord, b: SessionRecord): number {
  const aTime = (a.updatedAt ?? a.createdAt)?.getTime() ?? 0
  const bTime = (b.updatedAt ?? b.createdAt)?.getTime() ?? 0
  if (bTime !== aTime) return bTime - aTime
  return a.sessionId.localeCompare(b.sessionId)
}

function compareProjects(a: ProjectRecord, b: ProjectRecord): number {
  const aTime = a.createdAt?.getTime() ?? 0
  const bTime = b.createdAt?.getTime() ?? 0
  if (bTime !== aTime) return bTime - aTime
  return a.projectId.localeCompare(b.projectId)
}

/**
 * Create a hybrid provider that reads current SQLite sessions alongside the
 * legacy JSON session tree. Listing stays metadata-only; expensive message and
 * part reads are routed lazily based on each record's source.
 */
function createHybridProvider(
  root: string,
  dbPath: string,
  options?: { strict?: boolean; forceWrite?: boolean; onWarning?: (warning: string) => void }
): DataProvider {
  const jsonProvider = createJsonlProvider(root)
  const sqliteProvider = createSqliteProvider(dbPath, options)
  let allSessionsPromise: Promise<SessionRecord[]> | null = null
  let allProjectsPromise: Promise<ProjectRecord[]> | null = null

  async function loadAllSessions(): Promise<SessionRecord[]> {
    if (!allSessionsPromise) {
      allSessionsPromise = Promise.all([
        jsonProvider.loadSessionRecords(),
        sqliteProvider.loadSessionRecords(),
      ]).then(([jsonSessions, sqliteSessions]) => {
        const byId = new Map<string, SessionRecord>()
        for (const session of jsonSessions) {
          byId.set(session.sessionId, session)
        }
        for (const session of sqliteSessions) {
          byId.set(session.sessionId, session)
        }
        return reindex(Array.from(byId.values()).sort(compareSessions))
      })
    }
    return allSessionsPromise
  }

  async function loadAllProjects(): Promise<ProjectRecord[]> {
    if (!allProjectsPromise) {
      allProjectsPromise = Promise.all([
        jsonProvider.loadProjectRecords(),
        sqliteProvider.loadProjectRecords(),
      ]).then(([jsonProjects, sqliteProjects]) => {
        const byId = new Map<string, ProjectRecord>()
        for (const project of jsonProjects) {
          byId.set(project.projectId, project)
        }
        for (const project of sqliteProjects) {
          byId.set(project.projectId, project)
        }
        return reindex(Array.from(byId.values()).sort(compareProjects))
      })
    }
    return allProjectsPromise
  }

  function clearCaches(): void {
    allSessionsPromise = null
    allProjectsPromise = null
  }

  function sourceProvider(record: { filePath: string }): DataProvider {
    return isSqliteRecord(record) ? sqliteProvider : jsonProvider
  }

  return {
    backend: "hybrid",

    dispose() {
      jsonProvider.dispose?.()
      sqliteProvider.dispose?.()
    },

    async loadProjectRecords() {
      return loadAllProjects()
    },

    async loadSessionRecords(options?: SessionLoadOptions) {
      const sessions = await loadAllSessions()
      if (!options?.projectId) {
        return sessions
      }
      return reindex(sessions.filter((session) => session.projectId === options.projectId))
    },

    async loadSessionChatIndex(sessionId: string) {
      const sessions = await loadAllSessions()
      const session = sessions.find((item) => item.sessionId === sessionId)
      return session ? sourceProvider(session).loadSessionChatIndex(sessionId) : []
    },

    async loadMessageParts(messageId: string) {
      const sqliteParts = await sqliteProvider.loadMessageParts(messageId)
      if (sqliteParts.length > 0) {
        return sqliteParts
      }
      return jsonProvider.loadMessageParts(messageId)
    },

    async hydrateChatMessageParts(message: ChatMessage) {
      const sessions = await loadAllSessions()
      const session = sessions.find((item) => item.sessionId === message.sessionId)
      return session ? sourceProvider(session).hydrateChatMessageParts(message) : jsonProvider.hydrateChatMessageParts(message)
    },

    async deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions) {
      const sqliteRecords = records.filter(isSqliteRecord)
      const jsonRecords = records.filter((record) => !isSqliteRecord(record))
      const [jsonResult, sqliteResult] = await Promise.all([
        jsonRecords.length ? jsonProvider.deleteProjectMetadata(jsonRecords, options) : Promise.resolve({ removed: [], failed: [] }),
        sqliteRecords.length ? sqliteProvider.deleteProjectMetadata(sqliteRecords, options) : Promise.resolve({ removed: [], failed: [] }),
      ])
      clearCaches()
      return { removed: [...jsonResult.removed, ...sqliteResult.removed], failed: [...jsonResult.failed, ...sqliteResult.failed] }
    },

    async deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions) {
      const sqliteRecords = records.filter(isSqliteRecord)
      const jsonRecords = records.filter((record) => !isSqliteRecord(record))
      const [jsonResult, sqliteResult] = await Promise.all([
        jsonRecords.length ? jsonProvider.deleteSessionMetadata(jsonRecords, options) : Promise.resolve({ removed: [], failed: [] }),
        sqliteRecords.length ? sqliteProvider.deleteSessionMetadata(sqliteRecords, options) : Promise.resolve({ removed: [], failed: [] }),
      ])
      clearCaches()
      return { removed: [...jsonResult.removed, ...sqliteResult.removed], failed: [...jsonResult.failed, ...sqliteResult.failed] }
    },

    async updateSessionTitle(session: SessionRecord, newTitle: string) {
      await sourceProvider(session).updateSessionTitle(session, newTitle)
      clearCaches()
    },

    async moveSession(session: SessionRecord, targetProjectId: string) {
      const moved = await sourceProvider(session).moveSession(session, targetProjectId)
      clearCaches()
      return moved
    },

    async copySession(session: SessionRecord, targetProjectId: string) {
      const copied = await sourceProvider(session).copySession(session, targetProjectId)
      clearCaches()
      return copied
    },

    async computeSessionTokenSummary(session: SessionRecord) {
      return sourceProvider(session).computeSessionTokenSummary(session)
    },

    async computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]) {
      return aggregateMixedTokenSummaries(sessions.filter((session) => session.projectId === projectId), sourceProvider)
    },

    async computeGlobalTokenSummary(sessions: SessionRecord[]) {
      return aggregateMixedTokenSummaries(sessions, sourceProvider)
    },

    async searchSessionsChat(sessions: SessionRecord[], query: string, options?: { maxResults?: number }) {
      const maxResults = options?.maxResults ?? 100
      const sqliteSessions = sessions.filter(isSqliteRecord)
      const jsonSessions = sessions.filter((session) => !isSqliteRecord(session))
      const sqliteResults = sqliteSessions.length
        ? await sqliteProvider.searchSessionsChat(sqliteSessions, query, { maxResults })
        : []
      if (sqliteResults.length >= maxResults) {
        return sqliteResults.slice(0, maxResults)
      }
      const jsonResults = jsonSessions.length
        ? await jsonProvider.searchSessionsChat(jsonSessions, query, { maxResults: maxResults - sqliteResults.length })
        : []
      return [...sqliteResults, ...jsonResults]
    },
  }
}

async function aggregateMixedTokenSummaries(
  sessions: SessionRecord[],
  sourceProvider: (record: SessionRecord) => DataProvider
): Promise<AggregateTokenSummary> {
  if (sessions.length === 0) {
    return {
      total: { kind: "unknown", reason: "no_messages" },
      knownOnly: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      unknownSessions: 0,
    }
  }

  const knownOnly = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  let unknownSessions = 0

  for (const session of sessions) {
    const summary = await sourceProvider(session).computeSessionTokenSummary(session)
    if (summary.kind === "known") {
      knownOnly.input += summary.tokens.input
      knownOnly.output += summary.tokens.output
      knownOnly.reasoning += summary.tokens.reasoning
      knownOnly.cacheRead += summary.tokens.cacheRead
      knownOnly.cacheWrite += summary.tokens.cacheWrite
      knownOnly.total += summary.tokens.total
    } else {
      unknownSessions += 1
    }
  }

  if (unknownSessions === sessions.length) {
    return {
      total: { kind: "unknown", reason: "missing" },
      knownOnly: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      unknownSessions,
    }
  }

  return {
    total: { kind: "known", tokens: { ...knownOnly } },
    knownOnly,
    unknownSessions,
  }
}

/**
 * Helper to aggregate token summaries from a batch-computed Map.
 *
 * Only includes sessions that appear in both the `sessions` array and the
 * `summaries` Map. Sessions missing from the Map are treated as unknown.
 */
function aggregateFromSummaries(
  sessions: SessionRecord[],
  summaries: Map<string, TokenSummary>
): AggregateTokenSummary {
  if (sessions.length === 0) {
    return {
      total: { kind: "unknown", reason: "no_messages" },
      knownOnly: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
      unknownSessions: 0,
    }
  }

  const knownOnly = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  }
  let unknownSessions = 0

  for (const session of sessions) {
    const summary = summaries.get(session.sessionId)
    if (summary && summary.kind === "known") {
      knownOnly.input += summary.tokens.input
      knownOnly.output += summary.tokens.output
      knownOnly.reasoning += summary.tokens.reasoning
      knownOnly.cacheRead += summary.tokens.cacheRead
      knownOnly.cacheWrite += summary.tokens.cacheWrite
      knownOnly.total += summary.tokens.total
    } else {
      unknownSessions += 1
    }
  }

  // If all sessions are unknown, total is unknown
  if (unknownSessions === sessions.length) {
    return {
      total: { kind: "unknown", reason: "missing" },
      knownOnly: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
      unknownSessions,
    }
  }

  return {
    total: { kind: "known", tokens: { ...knownOnly } },
    knownOnly,
    unknownSessions,
  }
}

// ========================
// Factory Function
// ========================

/**
 * Create a data provider based on the specified options.
 *
 * @param options - Configuration options for the provider.
 * @returns A DataProvider instance for the specified backend.
 * @throws Error if required options are missing.
 *
 * @example
 * ```ts
 * // JSONL backend
 * const jsonlProvider = createProvider({ root: '~/.local/share/opencode' })
 *
 * // SQLite backend
 * const sqliteProvider = createProvider({
 *   backend: 'sqlite',
 *   dbPath: '~/.local/share/opencode/opencode.db'
 * })
 * ```
 */
export function createProvider(options: DataProviderOptions = {}): DataProvider {
  // Auto-detect backend: prefer hybrid when both stores exist, then SQLite, then JSONL.
  // Explicit 'backend' option overrides auto-detection.
  let backend = options.backend
  if (!backend) {
    const dbPath = options.dbPath ?? DEFAULT_SQLITE_PATH
    const root = options.root ?? DEFAULT_ROOT
    const hasSqlite = existsSync(dbPath)
    const hasLegacySessions = existsSync(join(root, "storage", "session"))
    backend = hasSqlite && hasLegacySessions ? "hybrid" : hasSqlite ? "sqlite" : "jsonl"
  }

  // Validate backend value
  if (backend !== "jsonl" && backend !== "sqlite" && backend !== "hybrid") {
    throw new Error(
      `Invalid storage backend: "${backend}". Must be "jsonl", "sqlite", or "hybrid".`
    )
  }

  if (backend === "sqlite") {
    const dbPath = options.dbPath ?? DEFAULT_SQLITE_PATH
    return createSqliteProvider(dbPath, {
      strict: options.sqliteStrict,
      forceWrite: options.forceWrite,
      onWarning: options.onWarning,
    })
  }

  if (backend === "hybrid") {
    return createHybridProvider(options.root ?? DEFAULT_ROOT, options.dbPath ?? DEFAULT_SQLITE_PATH, {
      strict: options.sqliteStrict,
      forceWrite: options.forceWrite,
      onWarning: options.onWarning,
    })
  }

  // JSONL backend (default)
  const root = options.root ?? DEFAULT_ROOT
  return createJsonlProvider(root)
}

/**
 * Create a data provider from CLI global options.
 *
 * This is a convenience function for CLI commands to create a provider
 * based on the parsed global options (experimentalSqlite, dbPath, root).
 *
 * @param globalOptions - Parsed CLI global options.
 * @returns A DataProvider instance.
 */
export function createProviderFromGlobalOptions(globalOptions: {
  experimentalSqlite?: boolean
  dbPath?: string
  root?: string
  sqliteStrict?: boolean
  forceWrite?: boolean
}): DataProvider {
  // Explicit --sqlite flag or --db-path forces SQLite.
  if (globalOptions.experimentalSqlite || globalOptions.dbPath) {
    return createProvider({
      backend: "sqlite",
      dbPath: globalOptions.dbPath,
      sqliteStrict: globalOptions.sqliteStrict,
      forceWrite: globalOptions.forceWrite,
    })
  }

  // A non-default --root points at a specific legacy store, so keep CLI commands
  // JSONL-only unless the user also opts into SQLite with --db/--experimental-sqlite.
  if (globalOptions.root && resolve(globalOptions.root) !== resolve(DEFAULT_ROOT)) {
    return createProvider({
      backend: "jsonl",
      root: globalOptions.root,
    })
  }

  // Auto-detect: hybrid when both stores exist, SQLite when only opencode.db exists, else JSONL.
  return createProvider({
    root: globalOptions.root,
    sqliteStrict: globalOptions.sqliteStrict,
    forceWrite: globalOptions.forceWrite,
  })
}
