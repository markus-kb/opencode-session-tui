import type { KeyEvent, SelectOption } from "@opentui/core"
import { useKeyboard, useRenderer } from "@opentui/react"
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { copyToClipboardSync } from "../lib/clipboard"
import {
  ProjectRecord,
  SessionRecord,
  describeProject,
  describeSession,
  formatDate,
  formatDisplayPath,
  BatchOperationResult,
  TokenSummary,
  AggregateTokenSummary,
  clearTokenCache,
  ChatMessage,
  ChatPart,
  ChatSearchResult,
} from "../lib/opencode-data"
import { DEFAULT_SQLITE_PATH } from "../lib/opencode-data-sqlite"
import { createProvider, type DataProvider, type StorageBackend } from "../lib/opencode-data-provider"
import { createSearcher, type SearchCandidate } from "../lib/search"
import {
  createInitialTuiState,
  getGlobalTokenDisplayState,

  closeOverlay,
  openChatSearchOverlay,
  openChatViewerOverlay,
  openHome,
  openWorkspace,
  switchWorkspaceTab,
  type TuiOverlay,
  type TuiTab,
} from "./app-state"
import { formatAggregateSummaryShort, formatTokenCount } from "./format"
import { getResourcePolicy, isProjectMetadataEnabled, isSessionMetadataEnabled, isTokenSummaryEnabled, toWorkspaceDataLoadState, type ResourcePolicy } from "./resource-policy"
import { loadGlobalTokensFromSessionIndex, loadSessionIndex } from "./session-resource"
import { loadProjectIndex, filterSessionsByProject, reindexSessions } from "./project-resource"
import { computeProjectTokens, computeSessionTokens, computeFilteredProjectTokens } from "./token-resource"
import { buildTuiCommands, type TuiCommandSet } from "./command-definitions"
import { toCommandKey, toCommandScope, resolveCommand, type KeyRouteContext } from "./key-router"
import { getHomeDashboardModel } from "./home-dashboard"
import { detectStorageSources } from "./backend-resolver"
import { Bullet, Columns, KeyChip, OverlayFrame, PALETTE, SearchBar, Section } from "./components"
import { ConfirmBar, type ConfirmState } from "./confirm-bar"
import { StatusBar, type NotificationLevel } from "./status-bar"
import { HomeScreen } from "./home-screen"

type TabKey = TuiTab

type PanelHandle = {
  handleKey: (key: KeyEvent) => void
  refresh: () => void
}

type ProjectsPanelProps = {
  provider: DataProvider
  active: boolean
  locked: boolean
  searchQuery: string
  allSessions: SessionRecord[]
  resourcePolicy: ResourcePolicy
  cmdSet: TuiCommandSet
  onNotify: (message: string, level?: NotificationLevel) => void
  requestConfirm: (state: ConfirmState) => void
  onNavigateToSessions: (projectId: string) => void
}

type SessionsPanelProps = {
  provider: DataProvider
  active: boolean
  locked: boolean
  projectFilter: string | null
  searchQuery: string
  globalTokenSummary: AggregateTokenSummary | null
  allProjects: ProjectRecord[]
  allSessions: SessionRecord[]
  resourcePolicy: ResourcePolicy
  cmdSet: TuiCommandSet
  onRefresh: () => void
  onNotify: (message: string, level?: NotificationLevel) => void
  requestConfirm: (state: ConfirmState) => void
  onClearFilter: () => void
  onOpenChatViewer: (session: SessionRecord) => void
}

const MAX_CONFIRM_PREVIEW = 5

async function runBatchSessionOperation(
  provider: DataProvider,
  sessions: SessionRecord[],
  targetProjectId: string,
  mode: "move" | "copy"
): Promise<BatchOperationResult> {
  const succeeded: BatchOperationResult["succeeded"] = []
  const failed: BatchOperationResult["failed"] = []

  for (const session of sessions) {
    try {
      const newRecord =
        mode === "move"
          ? await provider.moveSession(session, targetProjectId)
          : await provider.copySession(session, targetProjectId)
      succeeded.push({ session, newRecord })
    } catch (error) {
      failed.push({
        session,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { succeeded, failed }
}

// Clipboard functionality moved to ../lib/clipboard.ts
// Use copyToClipboardSyncSync for fire-and-forget clipboard operations

type ProjectSelectorProps = {
  projects: ProjectRecord[]
  cursor: number
  onCursorChange: (index: number) => void
  onSelect: (project: ProjectRecord) => void
  onCancel: () => void
  operationMode: 'move' | 'copy'
  sessionCount: number
}

const ProjectSelector = ({
  projects,
  cursor,
  onCursorChange,
  onSelect,
  onCancel,
  operationMode,
  sessionCount
}: ProjectSelectorProps) => {
  const options: SelectOption[] = projects.map((p, idx) => ({
    name: `${formatDisplayPath(p.worktree)} (${p.projectId})`,
    description: p.state,
    value: idx
  }))

  return (
    <box
      title={`Select Target Project (${operationMode} ${sessionCount} session${sessionCount > 1 ? 's' : ''})`}
      style={{
        border: true,
        borderColor: operationMode === 'move' ? PALETTE.key : PALETTE.accent,
        padding: 1,
        position: 'absolute',
        top: 5,
        left: 5,
        right: 5,
        bottom: 5,
        zIndex: 100
      }}
    >
      <select
        options={options}
        selectedIndex={cursor}
        onChange={onCursorChange}
        onSelect={(idx) => {
          const project = projects[idx]
          if (project) onSelect(project)
        }}
        focused={true}
        showScrollIndicator
      />
      <text fg={PALETTE.muted}>Enter to select, Esc to cancel</text>
    </box>
  )
}

const ProjectsPanel = forwardRef<PanelHandle, ProjectsPanelProps>(function ProjectsPanel(
  { provider, active, locked, searchQuery, allSessions, resourcePolicy, cmdSet, onNotify, requestConfirm, onNavigateToSessions },
  ref,
) {
  const [records, setRecords] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingOnly, setMissingOnly] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  // Token state for projects
  const [currentProjectTokens, setCurrentProjectTokens] = useState<AggregateTokenSummary | null>(null)

  const missingCount = useMemo(() => records.filter((record) => record.state === "missing").length, [records])

  const visibleRecords = useMemo(() => {
    const base = missingOnly ? records.filter((record) => record.state === "missing") : records
    const q = searchQuery?.trim().toLowerCase() ?? ""
    if (!q) return base
    const tokens = q.split(/\s+/).filter(Boolean)
    return base.filter((record) => {
      const id = (record.projectId || "").toLowerCase()
      const path = (record.worktree || "").toLowerCase()
      return tokens.every((tok) => id.includes(tok) || path.includes(tok))
    })
  }, [records, missingOnly, searchQuery])

  const currentRecord = visibleRecords[cursor]

  const refreshRecords = useCallback(
    async (silent = false) => {
      setLoading(true)
      setError(null)
      try {
        const data = await provider.loadProjectRecords()
        setRecords(data)
        if (!silent) {
          onNotify(`Loaded ${data.length} project(s).`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        onNotify(`Failed to load projects: ${message}`, "error")
      } finally {
        setLoading(false)
      }
    },
    [provider, onNotify],
  )

  useEffect(() => {
    void refreshRecords(true)
  }, [refreshRecords])

  useEffect(() => {
    setSelectedIndexes((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const validIndexes = new Set(records.map((record) => record.index))
      let changed = false
      const next = new Set<number>()
      for (const index of prev) {
        if (validIndexes.has(index)) {
          next.add(index)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [records])

  useEffect(() => {
    setCursor((prev) => {
      if (visibleRecords.length === 0) {
        return 0
      }
      return Math.min(prev, visibleRecords.length - 1)
    })
  }, [visibleRecords.length])

  // Compute token summary for current project
  useEffect(() => {
    setCurrentProjectTokens(null)
    if (!currentRecord) {
      return
    }
    let cancelled = false
    computeProjectTokens(provider, resourcePolicy, currentRecord.projectId, allSessions).then((summary) => {
      if (!cancelled && summary) {
        setCurrentProjectTokens(summary)
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentRecord, allSessions, provider, resourcePolicy])

  const toggleSelection = useCallback((record: ProjectRecord | undefined) => {
    if (!record) {
      return
    }
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(record.index)) {
        next.delete(record.index)
      } else {
        next.add(record.index)
      }
      return next
    })
  }, [])

  const selectedRecords = useMemo(() => {
    if (selectedIndexes.size === 0) {
      return currentRecord ? [currentRecord] : []
    }
    return records.filter((record) => selectedIndexes.has(record.index))
  }, [records, selectedIndexes, currentRecord])

  const selectOptions: SelectOption[] = useMemo(() => {
    return visibleRecords.map((record) => {
      const selected = selectedIndexes.has(record.index)
      const prefix = selected ? "[*]" : "[ ]"
      const label = `${prefix} #${record.index} ${formatDisplayPath(record.worktree)} (${record.state})`
      return {
        name: label,
        description: "",
        value: record.index,
      }
    })
  }, [visibleRecords, selectedIndexes])

  const requestDeletion = useCallback(() => {
    if (selectedRecords.length === 0) {
      onNotify("No projects selected for deletion.", "error")
      return
    }
    requestConfirm({
      title: `Delete ${selectedRecords.length} project metadata entr${selectedRecords.length === 1 ? "y" : "ies"}?`,
      details: selectedRecords
        .slice(0, MAX_CONFIRM_PREVIEW)
        .map((record) => describeProject(record, { fullPath: true })),
      onConfirm: async () => {
        const { removed, failed } = await provider.deleteProjectMetadata(selectedRecords)
        setSelectedIndexes(new Set())
        const msg = failed.length
          ? `Removed ${removed.length} project file(s). Failed: ${failed.length}`
          : `Removed ${removed.length} project file(s).`
        onNotify(msg, failed.length ? "error" : "info")
        await refreshRecords(true)
      },
    })
  }, [selectedRecords, onNotify, requestConfirm, refreshRecords, provider])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      if (!active || locked) {
        return
      }
      const cmdKey = toCommandKey(key)
      const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: "projects", overlay: null, searchActive: false, confirmActive: false })
      if (cmdId === "projects:toggleSelect") {
        key.preventDefault()
        toggleSelection(currentRecord)
        return
      }
      if (cmdId === "projects:toggleMissing") {
        setMissingOnly((prev) => !prev)
        setCursor(0)
        return
      }
      if (cmdId === "projects:selectAll") {
        setSelectedIndexes((prev) => {
          if (visibleRecords.length === 0) {
            return prev
          }
          const next = new Set(prev)
          const allVisibleSelected = visibleRecords.every((record) => next.has(record.index))
          for (const record of visibleRecords) {
            if (allVisibleSelected) {
              next.delete(record.index)
            } else {
              next.add(record.index)
            }
          }
          return next
        })
        return
      }
      if (cmdId === "projects:clearSelection") {
        setSelectedIndexes(new Set())
        return
      }
      if (cmdId === "projects:deleteSelected") {
        requestDeletion()
        return
      }
      if (cmdId === "projects:navigateToSessions") {
        if (currentRecord) {
          onNavigateToSessions(currentRecord.projectId)
        }
        return
      }
    },
    [active, locked, currentRecord, visibleRecords, onNavigateToSessions, requestDeletion, toggleSelection, cmdSet],
  )

  useImperativeHandle(
    ref,
    () => ({
      handleKey,
      refresh: () => {
        void refreshRecords(true)
      },
    }),
    [handleKey, refreshRecords],
  )

  return (
    <box
      title="Projects"
      style={{
        border: true,
        borderColor: active ? "#22d3ee" : "#374151",
        flexDirection: "column",
        flexGrow: active ? 6 : 4,
        padding: 1,
      }}
    >
      <box flexDirection="column" marginBottom={1}>
        <text>Filter: {missingOnly ? "missing only" : "all"}</text>
        <text>
          Total: {records.length} | Missing: {missingCount} | Selected: {selectedIndexes.size}
        </text>
        <text>
          Keys: Space select, A select all, M toggle missing, D delete, Enter view sessions, Esc clear
        </text>
      </box>

      {error ? (
        <text fg="red">{error}</text>
      ) : loading ? (
        <text>Loading projects...</text>
      ) : visibleRecords.length === 0 ? (
        <text>No projects found.</text>
      ) : (
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <select
            style={{ flexGrow: 1 }}
            options={selectOptions}
            selectedIndex={Math.min(cursor, selectOptions.length - 1)}
            onChange={(index) => setCursor(index)}
            onSelect={(index) => {
              const record = visibleRecords[index]
              if (record) {
                onNavigateToSessions(record.projectId)
              }
            }}
            focused={active && !locked}
            showScrollIndicator
            showDescription
            wrapSelection={false}
          />
          {currentRecord ? (
            <box title="Details" style={{ border: true, marginTop: 1, padding: 1 }}>
              <text>Project: {currentRecord.projectId}  State: {currentRecord.state}</text>
              <text>Bucket: {currentRecord.bucket}  VCS: {currentRecord.vcs || "-"}</text>
              <text>Created: {formatDate(currentRecord.createdAt)}</text>
              <text>Path:</text>
              <text>{formatDisplayPath(currentRecord.worktree, { fullPath: true })}</text>
              <box style={{ marginTop: 1 }}>
                <text fg={PALETTE.accent}>Tokens: </text>
                {currentProjectTokens?.total.kind === 'known' ? (
                  <>
                    <text fg={PALETTE.success}>Total: {formatTokenCount(currentProjectTokens.total.tokens.total)}</text>
                    {currentProjectTokens.unknownSessions && currentProjectTokens.unknownSessions > 0 ? (
                      <text fg={PALETTE.muted}> (+{currentProjectTokens.unknownSessions} unknown sessions)</text>
                    ) : null}
                  </>
                ) : (
                  <text fg={PALETTE.muted}>{currentProjectTokens ? '?' : 'loading...'}</text>
                )}
              </box>
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})

const SessionsPanel = forwardRef<PanelHandle, SessionsPanelProps>(function SessionsPanel(
  { provider, active, locked, projectFilter, searchQuery, globalTokenSummary, allProjects, allSessions, resourcePolicy, cmdSet, onRefresh, onNotify, requestConfirm, onClearFilter, onOpenChatViewer },
  ref,
) {
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [sortMode, setSortMode] = useState<"updated" | "created">("updated")
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isSelectingProject, setIsSelectingProject] = useState(false)
  const [operationMode, setOperationMode] = useState<'move' | 'copy' | null>(null)
  const [availableProjects, setAvailableProjects] = useState<ProjectRecord[]>([])
  const [projectCursor, setProjectCursor] = useState(0)
  // Token state
  const [currentTokenSummary, setCurrentTokenSummary] = useState<TokenSummary | null>(null)
  const [filteredTokenSummary, setFilteredTokenSummary] = useState<AggregateTokenSummary | null>(null)

  const records = useMemo(() => reindexSessions(filterSessionsByProject(allSessions, projectFilter || undefined)), [allSessions, projectFilter])

  // Build fuzzy search candidates using the shared search library
  const searchCandidates = useMemo((): SearchCandidate<SessionRecord>[] => {
    return records.map((session) => ({
      item: session,
      searchText: [
        session.title || "",
        session.sessionId,
        session.directory || "",
        session.projectId,
      ].join(" ").replace(/\s+/g, " ").trim(),
    }))
  }, [records])

  // Build fuzzy searcher using the shared search library
  const searcher = useMemo(() => {
    return createSearcher(searchCandidates)
  }, [searchCandidates])

  const visibleRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const aDate = sortMode === "created" ? (a.createdAt ?? a.updatedAt) : (a.updatedAt ?? a.createdAt)
      const bDate = sortMode === "created" ? (b.createdAt ?? b.updatedAt) : (b.updatedAt ?? b.createdAt)
      const aTime = aDate?.getTime() ?? 0
      const bTime = bDate?.getTime() ?? 0
      if (bTime !== aTime) return bTime - aTime
      return a.sessionId.localeCompare(b.sessionId)
    })
    const q = searchQuery.trim()
    if (!q) return sorted

    // Use fuzzy search
    const results = searcher.search(q, { returnMatchData: true })

    // Sort by score (descending), then by timestamp (based on sortMode), then by sessionId
    const matched = results
      .map((match) => {
        const session = match.item.item
        const createdMs = session.createdAt?.getTime() ?? 0
        const updatedMs = (session.updatedAt ?? session.createdAt)?.getTime() ?? 0
        return {
          session,
          score: match.score,
          timeMs: sortMode === "created" ? createdMs : updatedMs,
        }
      })
      .sort((a, b) => {
        // Primary: score descending
        if (b.score !== a.score) return b.score - a.score
        // Secondary: time descending
        if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs
        // Tertiary: sessionId for stability
        return a.session.sessionId.localeCompare(b.session.sessionId)
      })
      .map((m) => m.session)

    // Cap results for very broad queries
    const MAX_RESULTS = 200
    if (matched.length > MAX_RESULTS) {
      return matched.slice(0, MAX_RESULTS)
    }
    return matched
  }, [records, sortMode, searchQuery, searcher])
  const currentSession = visibleRecords[cursor]

  useEffect(() => {
    setSelectedIndexes((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const validIndexes = new Set(records.map((record) => record.index))
      let changed = false
      const next = new Set<number>()
      for (const index of prev) {
        if (validIndexes.has(index)) {
          next.add(index)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [records])

  useEffect(() => {
    setCursor((prev) => {
      if (visibleRecords.length === 0) {
        return 0
      }
      return Math.min(prev, visibleRecords.length - 1)
    })
  }, [visibleRecords.length])

  // Compute token summary for current session
  useEffect(() => {
    setCurrentTokenSummary(null)
    if (!currentSession) {
      return
    }
    let cancelled = false
    computeSessionTokens(provider, resourcePolicy, currentSession).then((summary) => {
      if (!cancelled && summary) {
        setCurrentTokenSummary(summary)
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentSession, provider, resourcePolicy])

  // Compute filtered token summary (deferred to avoid UI freeze)
  useEffect(() => {
    setFilteredTokenSummary(null)
    if (records.length === 0) {
      return
    }

    let cancelled = false

    if (projectFilter) {
      computeFilteredProjectTokens(provider, resourcePolicy, projectFilter, records).then((summary) => {
        if (!cancelled && summary) {
          setFilteredTokenSummary(summary)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [records, projectFilter, provider, resourcePolicy])

  const toggleSelection = useCallback((session: SessionRecord | undefined) => {
    if (!session) {
      return
    }
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(session.index)) {
        next.delete(session.index)
      } else {
        next.add(session.index)
      }
      return next
    })
  }, [])

  const selectedSessions = useMemo(() => {
    if (selectedIndexes.size === 0) {
      return currentSession ? [currentSession] : []
    }
    return records.filter((record) => selectedIndexes.has(record.index))
  }, [records, selectedIndexes, currentSession])

  const selectOptions: SelectOption[] = useMemo(() => {
    return visibleRecords.map((session, idx) => {
      const selected = selectedIndexes.has(session.index)
      const prefix = selected ? "[*]" : "[ ]"
      const primary = session.title && session.title.trim().length > 0 ? session.title : session.sessionId
      const label = `${prefix} #${idx + 1} ${primary} (${session.version || "unknown"})`
      const stampBase = sortMode === "created" ? (session.createdAt ?? session.updatedAt) : (session.updatedAt ?? session.createdAt)
      const stamp = stampBase ? `${sortMode}: ${formatDate(stampBase)}` : `${sortMode}: ?`
      return {
        name: label,
        description: stamp,
        value: session.index,
      }
    })
  }, [visibleRecords, selectedIndexes, sortMode])

  const requestDeletion = useCallback(() => {
    if (selectedSessions.length === 0) {
      onNotify("No sessions selected for deletion.", "error")
      return
    }
    requestConfirm({
      title: `Delete ${selectedSessions.length} session entr${selectedSessions.length === 1 ? "y" : "ies"}?`,
      details: selectedSessions
        .slice(0, MAX_CONFIRM_PREVIEW)
        .map((session) => describeSession(session, { fullPath: true })),
      onConfirm: async () => {
        const { removed, failed } = await provider.deleteSessionMetadata(selectedSessions)
        setSelectedIndexes(new Set())
        const msg = failed.length
          ? `Removed ${removed.length} session file(s). Failed: ${failed.length}`
          : `Removed ${removed.length} session file(s).`
        onNotify(msg, failed.length ? "error" : "info")
        onRefresh()
      },
    })
  }, [selectedSessions, onNotify, requestConfirm, onRefresh, provider])

  const executeRename = useCallback(async () => {
    if (!currentSession || !renameValue.trim()) {
      onNotify('Title cannot be empty', 'error')
      setIsRenaming(false)
      return
    }
    if (renameValue.length > 200) {
      onNotify('Title too long (max 200 characters)', 'error')
      return
    }
    try {
      await provider.updateSessionTitle(currentSession, renameValue.trim())
      onNotify(`Renamed to "${renameValue.trim()}"`)
      setIsRenaming(false)
      setRenameValue('')
      onRefresh()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      onNotify(`Rename failed: ${msg}`, 'error')
    }
  }, [currentSession, renameValue, onNotify, onRefresh, provider])

  const executeTransfer = useCallback(async (
    targetProject: ProjectRecord,
    mode: 'move' | 'copy'
  ) => {
    setIsSelectingProject(false)
    setOperationMode(null)

    const result = await runBatchSessionOperation(
      provider,
      selectedSessions,
      targetProject.projectId,
      mode
    )

    setSelectedIndexes(new Set())

    const successCount = result.succeeded.length
    const failCount = result.failed.length
    const verb = mode === 'move' ? 'moved' : 'copied'

    if (failCount === 0) {
      onNotify(`Successfully ${verb} ${successCount} session(s) to ${targetProject.projectId}`)
    } else {
      onNotify(
        `${verb} ${successCount} session(s), ${failCount} failed`,
        'error'
      )
    }

    onRefresh()
  }, [selectedSessions, provider, onNotify, onRefresh])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      if (!active || locked) {
        return
      }

      if (isSelectingProject) {
        if (key.name === 'escape') {
          setIsSelectingProject(false)
          setOperationMode(null)
          return
        }
        if (key.name === 'return' || key.name === 'enter') {
          const targetProject = availableProjects[projectCursor]
          if (targetProject && operationMode) {
            void executeTransfer(targetProject, operationMode)
          }
          return
        }
        return
      }

      if (isRenaming) {
        if (key.name === 'escape') {
          setIsRenaming(false)
          setRenameValue('')
          return
        }
        if (key.name === 'return' || key.name === 'enter') {
          void executeRename()
          return
        }
        if (key.name === 'backspace') {
          setRenameValue(prev => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setRenameValue(prev => prev + ch)
          return
        }
        return
      }

      const cmdKey = toCommandKey(key)
      const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: "sessions", overlay: null, searchActive: false, confirmActive: false })
      if (cmdId === "sessions:toggleSelect") {
        key.preventDefault()
        toggleSelection(currentSession)
        return
      }
      if (cmdId === "sessions:selectAll") {
        setSelectedIndexes((prev) => {
          if (visibleRecords.length === 0) {
            return prev
          }
          const next = new Set(prev)
          const allVisibleSelected = visibleRecords.every((session) => next.has(session.index))
          for (const session of visibleRecords) {
            if (allVisibleSelected) {
              next.delete(session.index)
            } else {
              next.add(session.index)
            }
          }
          return next
        })
        return
      }
      if (cmdId === "sessions:toggleSort") {
        setSortMode((prev) => (prev === "updated" ? "created" : "updated"))
        return
      }
      if (cmdId === "sessions:clearFilter") {
        if (projectFilter) {
          onClearFilter()
        }
        return
      }
      if (cmdId === "sessions:clearSelection") {
        setSelectedIndexes(new Set())
        return
      }
      if (cmdId === "sessions:deleteSelected") {
        requestDeletion()
        return
      }
      if (cmdId === "sessions:copyId") {
        if (currentSession) {
          copyToClipboardSync(currentSession.sessionId)
          onNotify(`Copied ID ${currentSession.sessionId} to clipboard`)
        }
        return
      }
      if (cmdId === "sessions:renameSession") {
        if (currentSession) {
          setIsRenaming(true)
          setRenameValue(currentSession.title || '')
        }
        return
      }
      if (cmdId === "sessions:moveSessions") {
        if (selectedSessions.length === 0) {
          onNotify('No sessions selected for move', 'error')
          return
        }
        const filtered = projectFilter
          ? allProjects.filter(p => p.projectId !== projectFilter)
          : allProjects
        setAvailableProjects(filtered)
        setProjectCursor(0)
        setOperationMode('move')
        setIsSelectingProject(true)
        return
      }
      if (cmdId === "sessions:copySessions") {
        if (selectedSessions.length === 0) {
          onNotify('No sessions selected for copy', 'error')
          return
        }
        setAvailableProjects(allProjects)
        setProjectCursor(0)
        setOperationMode('copy')
        setIsSelectingProject(true)
        return
      }
      if (cmdId === "sessions:viewChat") {
        if (currentSession) {
          onOpenChatViewer(currentSession)
        }
        return
      }
      if (cmdId === "sessions:sessionInfo") {
        if (currentSession) {
          const title = currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : currentSession.sessionId
          onNotify(`Session ${title} [${currentSession.sessionId}] → ${formatDisplayPath(currentSession.directory)}`)
        }
        return
      }
    },
    [active, locked, currentSession, projectFilter, onClearFilter, onNotify, requestDeletion, toggleSelection, isRenaming, executeRename, isSelectingProject, availableProjects, projectCursor, operationMode, executeTransfer, selectedSessions, allProjects, onOpenChatViewer, cmdSet],
  )

  useImperativeHandle(
    ref,
    () => ({
      handleKey,
      refresh: () => {
        onRefresh()
      },
    }),
    [handleKey, onRefresh],
  )

  return (
    <box
      title="Sessions"
      style={{
        border: true,
        borderColor: active ? "#22c55e" : "#374151",
        flexDirection: "column",
        flexGrow: active ? 6 : 4,
        padding: 1,
      }}
    >
      <box flexDirection="column" marginBottom={1}>
        <text>Filter: {projectFilter ? `project ${projectFilter}` : "none"} | Sort: {sortMode} | Search: {searchQuery ? `${searchQuery} (fuzzy)` : "(none)"} | Selected: {selectedIndexes.size}</text>
        <text>Keys: Space select, A select all, S sort, D delete, Y copy ID, V view chat, F search chats, Shift+R rename, M move, P copy, C clear filter, Esc clear</text>
      </box>

      {isRenaming ? (
        <box style={{ border: true, borderColor: PALETTE.key, padding: 1, marginBottom: 1 }}>
          <text>Rename: </text>
          <text fg={PALETTE.key}>{renameValue}</text>
          <text fg={PALETTE.muted}> (Enter confirm, Esc cancel)</text>
        </box>
      ) : null}

      {isSelectingProject && operationMode ? (
        <ProjectSelector
          projects={availableProjects}
          cursor={projectCursor}
          onCursorChange={setProjectCursor}
          onSelect={(project) => executeTransfer(project, operationMode)}
          onCancel={() => {
            setIsSelectingProject(false)
            setOperationMode(null)
          }}
          operationMode={operationMode}
          sessionCount={selectedSessions.length}
        />
      ) : null}

      {allSessions.length === 0 && records.length === 0 ? (
        <text>No sessions found.</text>
      ) : visibleRecords.length === 0 ? (
        <text>No sessions found.</text>
      ) : (
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <select
            style={{ flexGrow: 1 }}
            options={selectOptions}
            selectedIndex={Math.min(cursor, selectOptions.length - 1)}
            onChange={(index) => setCursor(index)}
            onSelect={(index) => {
              const session = visibleRecords[index]
              if (session) {
                const title = session.title && session.title.trim().length > 0 ? session.title : session.sessionId
                onNotify(`Session ${title} [${session.sessionId}] → ${formatDisplayPath(session.directory)}`)
              }
            }}
            focused={active && !locked && !isSelectingProject && !isRenaming}
            showScrollIndicator
            showDescription={false}
            wrapSelection={false}
          />
          {currentSession ? (
            <box title="Details" style={{ border: true, marginTop: 1, padding: 1 }}>
              <text>
                Session: {currentSession.sessionId}  Version: {currentSession.version || "unknown"}
              </text>
              <text>Title: {currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : "(no title)"}</text>
              <text>Project: {currentSession.projectId}</text>
              <text>Updated: {formatDate(currentSession.updatedAt || currentSession.createdAt)}</text>
              <text>Directory:</text>
              <text>{formatDisplayPath(currentSession.directory, { fullPath: true })}</text>
              <box style={{ marginTop: 1 }}>
                <text fg={PALETTE.accent}>Tokens: </text>
                {currentTokenSummary?.kind === 'known' ? (
                  <>
                    <text>In: {formatTokenCount(currentTokenSummary.tokens.input)} </text>
                    <text>Out: {formatTokenCount(currentTokenSummary.tokens.output)} </text>
                    <text>Reason: {formatTokenCount(currentTokenSummary.tokens.reasoning)} </text>
                    <text>Cache R: {formatTokenCount(currentTokenSummary.tokens.cacheRead)} </text>
                    <text>Cache W: {formatTokenCount(currentTokenSummary.tokens.cacheWrite)} </text>
                    <text fg={PALETTE.success}>Total: {formatTokenCount(currentTokenSummary.tokens.total)}</text>
                  </>
                ) : (
                  <text fg={PALETTE.muted}>{currentTokenSummary ? '?' : 'loading...'}</text>
                )}
              </box>
              {projectFilter && filteredTokenSummary ? (
                <box style={{ marginTop: 1 }}>
                  <text fg={PALETTE.info}>Filtered ({projectFilter}): </text>
                  <text>{formatAggregateSummaryShort(filteredTokenSummary)}</text>
                </box>
              ) : null}
              {globalTokenSummary ? (
                <box>
                  <text fg={PALETTE.primary}>Global: </text>
                  <text>{formatAggregateSummaryShort(globalTokenSummary)}</text>
                </box>
              ) : null}
              <text fg={PALETTE.muted} style={{ marginTop: 1 }}>Press Y to copy ID</text>
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})

const SCOPE_SECTION_TITLES: Record<string, string> = {
  home: "Home",
  global: "Global",
  projects: "Projects",
  sessions: "Sessions",
  chat: "Chat Viewer",
  search: "Chat Search",
  confirm: "Confirm",
}

const HelpScreen = ({ cmdSet, onDismiss }: { cmdSet: TuiCommandSet; onDismiss: () => void }) => {
  const sections = cmdSet.getScopedKeyReference()
  const leftSections = sections.filter(s => s.scope === "home" || s.scope === "global" || s.scope === "projects")
  const rightSections = sections.filter(s => s.scope === "sessions" || s.scope === "chat" || s.scope === "search" || s.scope === "confirm")

  const renderSection = (section: import("./command-definitions").ScopedKeySection) => (
    <Section title={SCOPE_SECTION_TITLES[section.scope] ?? section.scope}>
      {section.commands.map((cmd) => (
        <Bullet key={cmd.id}>
          {cmd.keys.map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && <text> / </text>}
              <KeyChip k={k} />
            </React.Fragment>
          ))}
          <text> — {cmd.label}</text>
        </Bullet>
      ))}
    </Section>
  )

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 2, border: true }}>
      <text fg={PALETTE.primary}>OpenCode Metadata Manager (fork) — Help</text>
      <text fg={PALETTE.muted}>Quick reference for keys and actions</text>
      <Columns>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          {leftSections.map(renderSection)}
          <Section title="Tips">
            <Bullet>
              <text>Use </text> <KeyChip k="M" /> <text> to quickly isolate missing projects.</text>
            </Bullet>
            <Bullet>
              <text>Press </text> <KeyChip k="R" /> <text> to refresh after cleanup.</text>
            </Bullet>
            <Bullet>
              <text>Dismiss help with </text> <KeyChip k="Enter" /> <text> or </text> <KeyChip k="Esc" />
            </Bullet>
          </Section>
        </box>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          {rightSections.map(renderSection)}
        </box>
      </Columns>
      <text fg={PALETTE.info}>Press Enter or Esc to dismiss this screen.</text>
    </box>
  )
}

type ChatViewerProps = {
  session: SessionRecord
  messages: ChatMessage[]
  cursor: number
  onCursorChange: (index: number) => void
  loading: boolean
  error: string | null
  onClose: () => void
  onHydrateMessage: (message: ChatMessage) => void
  onCopyMessage: (message: ChatMessage) => void
}

const ChatViewer = ({
  session,
  messages,
  cursor,
  onCursorChange,
  loading,
  error,
  onClose,
  onHydrateMessage,
  onCopyMessage,
}: ChatViewerProps) => {
  const currentMessage = messages[cursor]

  // Trigger hydration for current message if parts not loaded
  useEffect(() => {
    if (currentMessage && currentMessage.parts === null) {
      onHydrateMessage(currentMessage)
    }
  }, [currentMessage, onHydrateMessage])

  const messageOptions: SelectOption[] = useMemo(() => {
    return messages.map((msg, idx) => {
      const roleLabel = msg.role === "user" ? "[user]" : msg.role === "assistant" ? "[asst]" : "[???]"
      const timestamp = msg.createdAt
        ? msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "??:??"
      const preview = msg.previewText.slice(0, 60) + (msg.previewText.length > 60 ? "..." : "")
      return {
        name: `${roleLabel} ${timestamp} - ${preview}`,
        description: "",
        value: idx,
      }
    })
  }, [messages])

  // Render parts for the current message
  const renderMessageContent = () => {
    if (!currentMessage) {
      return <text fg={PALETTE.muted}>No message selected</text>
    }

    if (currentMessage.parts === null) {
      return <text fg={PALETTE.muted}>Loading message content...</text>
    }

    if (currentMessage.parts.length === 0) {
      return <text fg={PALETTE.muted}>[no content]</text>
    }

    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        {currentMessage.parts.map((part, idx) => (
          <box key={part.partId} style={{ flexDirection: "column" }}>
            {part.type === "tool" ? (
              <text fg={PALETTE.accent}>
                [tool: {part.toolName ?? "unknown"}] {part.toolStatus ?? ""}
              </text>
            ) : part.type === "subtask" ? (
              <text fg={PALETTE.info}>[subtask]</text>
            ) : null}
            <text>{part.text.slice(0, 2000)}{part.text.length > 2000 ? "\n[... truncated]" : ""}</text>
          </box>
        ))}
        {currentMessage.totalChars !== null && currentMessage.totalChars > 2000 ? (
          <text fg={PALETTE.muted}>
            Showing first 2000 chars of {currentMessage.totalChars} total
          </text>
        ) : null}
      </box>
    )
  }

  const title = session.title && session.title.trim() ? session.title : session.sessionId

  return (
    <OverlayFrame title={`Chat: ${title} (READ-ONLY)`} borderColor={PALETTE.primary}>
      {/* Header */}
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text fg={PALETTE.accent}>Session: </text>
        <text>{session.sessionId}</text>
        <text fg={PALETTE.muted}> | </text>
        <text fg={PALETTE.accent}>Project: </text>
        <text>{session.projectId}</text>
        <text fg={PALETTE.muted}> | </text>
        <text fg={PALETTE.accent}>Messages: </text>
        <text>{messages.length}</text>
        {loading ? <text fg={PALETTE.key}> (loading...)</text> : null}
      </box>

      {error ? (
        <text fg={PALETTE.danger}>Error: {error}</text>
      ) : messages.length === 0 && !loading ? (
        <text fg={PALETTE.muted}>No messages found in this session.</text>
      ) : (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          {/* Left pane: message list */}
          <box
            style={{
              border: true,
              borderColor: PALETTE.muted,
              flexGrow: 4,
              flexDirection: "column",
              padding: 1,
            }}
            title="Messages"
          >
            <select
              options={messageOptions}
              selectedIndex={cursor}
              onChange={onCursorChange}
              focused={true}
              showScrollIndicator
              wrapSelection={false}
            />
          </box>

          {/* Right pane: message detail */}
          <box
            style={{
              border: true,
              borderColor: currentMessage?.role === "user" ? PALETTE.accent : PALETTE.primary,
              flexGrow: 6,
              flexDirection: "column",
              padding: 1,
              overflow: "hidden",
            }}
            title={currentMessage ? `${currentMessage.role} message` : "Details"}
          >
            {currentMessage ? (
              <box style={{ flexDirection: "column" }}>
                <box style={{ flexDirection: "row", marginBottom: 1 }}>
                  <text fg={PALETTE.accent}>Role: </text>
                  <text fg={currentMessage.role === "user" ? PALETTE.accent : PALETTE.primary}>
                    {currentMessage.role}
                  </text>
                  <text fg={PALETTE.muted}> | </text>
                  <text fg={PALETTE.accent}>Time: </text>
                  <text>{formatDate(currentMessage.createdAt)}</text>
                </box>
                {currentMessage.tokens ? (
                  <box style={{ flexDirection: "row", marginBottom: 1 }}>
                    <text fg={PALETTE.info}>Tokens: </text>
                    <text>
                      In: {formatTokenCount(currentMessage.tokens.input)} |
                      Out: {formatTokenCount(currentMessage.tokens.output)} |
                      Total: {formatTokenCount(currentMessage.tokens.total)}
                    </text>
                  </box>
                ) : null}
                <box style={{ flexGrow: 1, overflow: "hidden" }}>
                  {renderMessageContent()}
                </box>
              </box>
            ) : (
              <text fg={PALETTE.muted}>Select a message to view details</text>
            )}
          </box>
        </box>
      )}

      {/* Footer */}
      <box style={{ marginTop: 1 }}>
        <text fg={PALETTE.muted}>
          Esc close | Up/Down navigate | PgUp/PgDn jump | Y copy message
        </text>
      </box>
    </OverlayFrame>
  )
}

export const App = ({
  root,
  backend,
  dbPath,
  sqliteStrict,
  forceWrite,
}: {
  root: string
  backend: StorageBackend
  dbPath?: string
  sqliteStrict: boolean
  forceWrite: boolean
}) => {
  const renderer = useRenderer()
  const projectsRef = useRef<PanelHandle>(null)
  const sessionsRef = useRef<PanelHandle>(null)

  const [tuiState, setTuiState] = useState(createInitialTuiState)
  const activeTab: TabKey = tuiState.screen.name === "workspace" ? tuiState.screen.activeTab : "projects"
  const isHome = tuiState.screen.name === "home"
  const [sessionFilter, setSessionFilter] = useState<string | null>(null)
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [status, setStatus] = useState("Ready")
  const [statusLevel, setStatusLevel] = useState<NotificationLevel>("info")
  const [sqliteWarning, setSqliteWarning] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  // Global token state
  const [globalTokens, setGlobalTokens] = useState<AggregateTokenSummary | null>(null)
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0)

  // Chat viewer state
  const chatViewerOpen = tuiState.overlay?.name === "chatViewer"
  const [chatSession, setChatSession] = useState<SessionRecord | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatCursor, setChatCursor] = useState(0)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatPartsCache, setChatPartsCache] = useState<Map<string, ChatMessage>>(new Map())

  // Chat search overlay state
  const chatSearchOpen = tuiState.overlay?.name === "chatSearch"
  const [chatSearchQuery, setChatSearchQuery] = useState("")
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([])
  const [chatSearchCursor, setChatSearchCursor] = useState(0)
  const [chatSearching, setChatSearching] = useState(false)
  const [allProjects, setAllProjects] = useState<ProjectRecord[]>([])
  const [projectIndexLoaded, setProjectIndexLoaded] = useState(false)
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([])
  const [sessionIndexLoaded, setSessionIndexLoaded] = useState(false)

  const resolvedDbPath = useMemo(() => {
    if (backend !== "sqlite") {
      return undefined
    }
    return dbPath ?? DEFAULT_SQLITE_PATH
  }, [backend, dbPath])

  const notify = useCallback((message: string, level: NotificationLevel = "info") => {
    setStatus(message)
    setStatusLevel(level)
  }, [])

  const provider = useMemo(() => {
    return createProvider({
      backend,
      root,
      dbPath: resolvedDbPath,
      sqliteStrict,
      forceWrite,
      onWarning: (message) => {
        setSqliteWarning(message)
        notify(message, "error")
      },
    })
  }, [backend, root, resolvedDbPath, sqliteStrict, forceWrite, notify, setSqliteWarning])

  const resourcePolicy = useMemo(() => getResourcePolicy(tuiState), [tuiState])
  const workspaceDataLoadState = useMemo(() => toWorkspaceDataLoadState(resourcePolicy), [resourcePolicy])
  const cmdSet = useMemo(() => buildTuiCommands(), [])

  const globalTokenDisplay = useMemo(
    () => getGlobalTokenDisplayState(globalTokens, workspaceDataLoadState),
    [globalTokens, workspaceDataLoadState],
  )

  const storageSources = useMemo(
    () => detectStorageSources({ defaultSqlitePath: resolvedDbPath ?? DEFAULT_SQLITE_PATH, root }),
    [resolvedDbPath, root],
  )

  const homeDashboard = useMemo(
    () => getHomeDashboardModel({
      backend,
      root,
      dbPath: resolvedDbPath,
      tokenLabel: globalTokenDisplay.kind === "known"
        ? formatTokenCount(globalTokenDisplay.summary.total.tokens.total)
        : globalTokenDisplay.label,
      sqliteAvailable: storageSources.sqliteAvailable,
      legacyJsonAvailable: storageSources.legacyJsonAvailable,
    }),
    [backend, root, resolvedDbPath, globalTokenDisplay, storageSources],
  )

  useEffect(() => {
    return () => {
      provider.dispose?.()
    }
  }, [provider])

  // Load project index once for shared consumers (session move/copy selectors, etc.).
  useEffect(() => {
    if (!isProjectMetadataEnabled(resourcePolicy)) {
      setAllProjects([])
      setProjectIndexLoaded(false)
      return
    }
    let cancelled = false
    setProjectIndexLoaded(false)
    loadProjectIndex(provider, resourcePolicy).then((result) => {
      if (!cancelled) {
        setAllProjects(result.records)
        setProjectIndexLoaded(result.kind === "loaded")
      }
    })
    return () => { cancelled = true }
  }, [provider, resourcePolicy, tokenRefreshKey])

  // Load all sessions once for root-level token summaries and chat search.
  useEffect(() => {
    if (!isSessionMetadataEnabled(resourcePolicy)) {
      setAllSessions([])
      setSessionIndexLoaded(false)
      return
    }
    let cancelled = false
    setSessionIndexLoaded(false)
    loadSessionIndex(provider, resourcePolicy).then((result) => {
      if (!cancelled) {
        setAllSessions(result.records)
        setSessionIndexLoaded(result.kind === "loaded")
      }
    })
    return () => { cancelled = true }
  }, [provider, resourcePolicy, tokenRefreshKey])

  // Compute global tokens from the shared session index instead of reloading metadata.
  useEffect(() => {
    if (!isTokenSummaryEnabled(resourcePolicy) || !sessionIndexLoaded) {
      setGlobalTokens(null)
      return
    }
    let cancelled = false
    loadGlobalTokensFromSessionIndex(provider, resourcePolicy, allSessions).then((summary) => {
      if (!cancelled && summary) {
        setGlobalTokens(summary)
      }
    })
    return () => { cancelled = true }
  }, [allSessions, provider, resourcePolicy, sessionIndexLoaded])

  const requestConfirm = useCallback((state: ConfirmState) => {
    setConfirmState(state)
    setConfirmBusy(false)
  }, [])

  const cancelConfirm = useCallback(() => {
    setConfirmState(null)
    setConfirmBusy(false)
  }, [])

  const executeConfirm = useCallback(async () => {
    if (!confirmState || confirmBusy) {
      return
    }
    try {
      setConfirmBusy(true)
      await confirmState.onConfirm()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notify(`Action failed: ${message}`, "error")
    } finally {
      setConfirmBusy(false)
      setConfirmState(null)
    }
  }, [confirmState, confirmBusy, notify])

  const switchTab = useCallback((direction: "next" | "prev" | TabKey) => {
    setTuiState((prev) => switchWorkspaceTab(prev, direction))
  }, [])

  // Chat viewer controls
  const openChatViewer = useCallback(async (session: SessionRecord) => {
    setTuiState((prev) => openChatViewerOverlay(prev, session.sessionId))
    setChatSession(session)
    setChatMessages([])
    setChatCursor(0)
    setChatLoading(true)
    setChatError(null)
    setChatPartsCache(new Map())

    try {
      const messages = await provider.loadSessionChatIndex(session.sessionId)
      setChatMessages(messages)
      if (messages.length > 0) {
        setChatCursor(0)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setChatError(msg)
    } finally {
      setChatLoading(false)
    }
  }, [provider])

  const closeChatViewer = useCallback(() => {
    setTuiState((prev) => closeOverlay(prev))
    setChatSession(null)
    setChatMessages([])
    setChatCursor(0)
    setChatLoading(false)
    setChatError(null)
    setChatPartsCache(new Map())
  }, [])

  const hydrateMessage = useCallback(async (message: ChatMessage) => {
    // Check cache first
    const cached = chatPartsCache.get(message.messageId)
    if (cached) {
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? cached : m
      ))
      return
    }

    try {
      const hydrated = await provider.hydrateChatMessageParts(message)
      setChatPartsCache(prev => new Map(prev).set(message.messageId, hydrated))
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? hydrated : m
      ))
    } catch (err) {
      // On error, set a placeholder
      const errorMsg: ChatMessage = {
        ...message,
        parts: [],
        previewText: "[failed to load]",
        totalChars: 0,
      }
      setChatMessages(prev => prev.map(m =>
        m.messageId === message.messageId ? errorMsg : m
      ))
    }
  }, [provider, chatPartsCache])

  const copyChatMessage = useCallback((message: ChatMessage) => {
    if (!message.parts || message.parts.length === 0) {
      notify("No content to copy", "error")
      return
    }
    const text = message.parts.map(p => p.text).join('\n\n')
    copyToClipboardSync(text)
    notify(`Copied ${text.length} chars to clipboard`)
  }, [notify])

  // Chat search controls
  const openChatSearch = useCallback(() => {
    setTuiState((prev) => openChatSearchOverlay(prev))
    setChatSearchQuery("")
    setChatSearchResults([])
    setChatSearchCursor(0)
    setChatSearching(false)
  }, [])

  const closeChatSearch = useCallback(() => {
    setTuiState((prev) => closeOverlay(prev))
    setChatSearchQuery("")
    setChatSearchResults([])
    setChatSearchCursor(0)
    setChatSearching(false)
  }, [])

  const executeChatSearch = useCallback(async () => {
    if (!chatSearchQuery.trim()) {
      setChatSearchResults([])
      return
    }

    setChatSearching(true)

    try {
      // Filter to project if filter is active
      const sessionsToSearch = sessionFilter
        ? allSessions.filter(s => s.projectId === sessionFilter)
        : allSessions

      const results = await provider.searchSessionsChat(sessionsToSearch, chatSearchQuery, { maxResults: 100 })
      setChatSearchResults(results)
      setChatSearchCursor(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notify(`Search failed: ${msg}`, "error")
      setChatSearchResults([])
    } finally {
      setChatSearching(false)
    }
  }, [chatSearchQuery, sessionFilter, allSessions, provider, notify])

  const handleChatSearchResult = useCallback(async (result: ChatSearchResult) => {
    // Find the session and open chat viewer at the matching message
    const session = allSessions.find(s => s.sessionId === result.sessionId)
    if (!session) {
      notify("Session not found", "error")
      return
    }

    closeChatSearch()
    await openChatViewer(session)

    // Find the message index in the chat viewer
    // Wait a bit for the chat viewer to load
    setTimeout(() => {
      setChatMessages(prev => {
        const idx = prev.findIndex(m => m.messageId === result.messageId)
        if (idx !== -1) {
          setChatCursor(idx)
        }
        return prev
      })
    }, 100)
  }, [allSessions, closeChatSearch, openChatViewer, notify])

  const handleGlobalKey = useCallback(
    (key: KeyEvent) => {
      // Search input mode takes precedence
      if (searchActive) {
        if (key.name === "escape") {
          setSearchActive(false)
          setSearchQuery("")
          return
        }
        if (key.name === "return" || key.name === "enter") {
          setSearchActive(false)
          return
        }
        if (key.name === "backspace") {
          setSearchQuery((prev) => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + ch)
          return
        }
        return
      }
      if (confirmState) {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: null, searchActive, confirmActive: true })
        if (cmdId === "confirm:cancel") {
          cancelConfirm()
          return
        }
        if (cmdId === "confirm:ok") {
          void executeConfirm()
          return
        }
        return
      }

      if (chatViewerOpen) {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: tuiState.overlay, searchActive: false, confirmActive: false })
        if (cmdId === "chat:close") {
          closeChatViewer()
          return
        }
        if (cmdId === "chat:prev") {
          setChatCursor(prev => Math.max(0, prev - 1))
          return
        }
        if (cmdId === "chat:next") {
          setChatCursor(prev => Math.min(chatMessages.length - 1, prev + 1))
          return
        }
        if (cmdId === "chat:pageUp") {
          setChatCursor(prev => Math.max(0, prev - 10))
          return
        }
        if (cmdId === "chat:pageDown") {
          setChatCursor(prev => Math.min(chatMessages.length - 1, prev + 10))
          return
        }
        if (cmdId === "chat:home") {
          setChatCursor(0)
          return
        }
        if (cmdId === "chat:end") {
          setChatCursor(chatMessages.length - 1)
          return
        }
        if (cmdId === "chat:copy") {
          const msg = chatMessages[chatCursor]
          if (msg) {
            copyChatMessage(msg)
          }
          return
        }
        return
      }

      if (chatSearchOpen) {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: tuiState.overlay, searchActive: false, confirmActive: false })
        if (cmdId === "search:close") {
          closeChatSearch()
          return
        }
        if (cmdId === "search:action") {
          if (chatSearchResults.length > 0) {
            const result = chatSearchResults[chatSearchCursor]
            if (result) {
              void handleChatSearchResult(result)
            }
          } else {
            void executeChatSearch()
          }
          return
        }
        if (cmdId === "search:prev") {
          setChatSearchCursor(prev => Math.max(0, prev - 1))
          return
        }
        if (cmdId === "search:next") {
          setChatSearchCursor(prev => Math.min(chatSearchResults.length - 1, prev + 1))
          return
        }
        if (key.name === "backspace") {
          setChatSearchQuery(prev => prev.slice(0, -1))
          return
        }
        const ch = key.sequence
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
          setChatSearchQuery(prev => prev + ch)
          return
        }
        return
      }

      if (isHome) {
        const cmdKey = toCommandKey(key)
        const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: "home", overlay: null, searchActive: false, confirmActive: false })
        if (cmdId === "quit") {
          renderer.destroy()
          return
        }
        if (cmdId === "homeDismiss") {
          setTuiState((prev) => openWorkspace(prev))
          return
        }
        return
      }

      const cmdKey = toCommandKey(key)
      const scope = toCommandScope({ screen: activeTab, overlay: tuiState.overlay, searchActive, confirmActive: Boolean(confirmState) })
      const cmdId = resolveCommand(cmdSet.registry, cmdKey, { screen: activeTab, overlay: tuiState.overlay, searchActive, confirmActive: Boolean(confirmState) })

      if (cmdId === "quit") {
        renderer.destroy()
        return
      }

      if (cmdId === "help") {
        setTuiState((prev) => openHome(prev))
        return
      }

      if (cmdId === "search") {
        setSearchActive(true)
        setSearchQuery("")
        return
      }

      if (cmdId === "clearSearch" && searchQuery) {
        setSearchQuery("")
        return
      }

      if (cmdId === "nextTab") {
        switchTab("next")
        return
      }

      if (cmdId === "tab1") {
        switchTab("projects")
        return
      }

      if (cmdId === "tab2") {
        switchTab("sessions")
        return
      }

      if (cmdId === "reload") {
        clearTokenCache()
        setTokenRefreshKey((k) => k + 1)
        if (activeTab === "projects") {
          projectsRef.current?.refresh()
        } else {
          sessionsRef.current?.refresh()
        }
        notify("Reload requested...")
        return
      }

      if (cmdId === "chatSearch") {
        openChatSearch()
        return
      }

      const handler = activeTab === "projects" ? projectsRef.current : sessionsRef.current
      handler?.handleKey(key)
    },
    [activeTab, cancelConfirm, cmdSet, confirmState, executeConfirm, notify, renderer, searchActive, searchQuery, isHome, switchTab, chatViewerOpen, chatMessages, chatCursor, closeChatViewer, copyChatMessage, chatSearchOpen, chatSearchResults, chatSearchCursor, closeChatSearch, executeChatSearch, handleChatSearchResult, openChatSearch, tuiState.overlay],
  )

  useKeyboard(handleGlobalKey)

  const handleNavigateToSessions = useCallback(
    (projectId: string) => {
      setSessionFilter(projectId)
      setTuiState((prev) => openWorkspace(prev, "sessions"))
      notify(`Filtering sessions by ${projectId}`)
    },
    [notify],
  )

  const clearSessionFilter = useCallback(() => {
    setSessionFilter(null)
    notify("Cleared session filter")
  }, [notify])

  return (
    <box style={{ flexDirection: "column", padding: 1, flexGrow: 1 }}>
      <box flexDirection="column" marginBottom={1}>
        <box style={{ flexDirection: "row", gap: 2 }}>
          <text fg="#a5b4fc">OpenCode Metadata Manager (fork)</text>
          <text fg={PALETTE.muted}>|</text>
          <text fg={PALETTE.accent}>Global Tokens: </text>
          {globalTokenDisplay.kind === "known" ? (
            <>
              <text fg={PALETTE.success}>{formatTokenCount(globalTokenDisplay.summary.total.tokens.total)}</text>
              {globalTokenDisplay.summary.unknownSessions && globalTokenDisplay.summary.unknownSessions > 0 ? (
                <text fg={PALETTE.muted}> (+{globalTokenDisplay.summary.unknownSessions} unknown)</text>
              ) : null}
            </>
          ) : (
            <text fg={PALETTE.muted}>{globalTokenDisplay.label}</text>
          )}
        </box>
        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg={PALETTE.accent}>Storage:</text>
          <text fg={backend === "sqlite" || backend === "hybrid" ? PALETTE.info : PALETTE.muted}>
            {backend === "hybrid" ? "Hybrid" : backend === "sqlite" ? "SQLite" : "JSONL"}
          </text>
          <text fg={PALETTE.muted}>|</text>
          <text>
            {backend === "sqlite" || backend === "hybrid"
              ? `DB: ${formatDisplayPath(resolvedDbPath ?? "(default)")}`
              : `Root: ${formatDisplayPath(root)}`}
          </text>
        </box>
        <text>
          Tabs: [1] Projects [2] Sessions | Active: {activeTab} | Global: Tab switch, / search, X clear, R reload, Q quit, ? help
        </text>
        {sessionFilter ? <text fg="#a3e635">Session filter: {sessionFilter}</text> : null}
        {(backend === "sqlite" || backend === "hybrid") && sqliteWarning ? (
          <text fg={PALETTE.danger}>SQLite warning: {sqliteWarning}</text>
        ) : null}
      </box>

      {isHome
        ? null
        : searchActive || searchQuery
        ? <SearchBar active={searchActive} context={activeTab} query={searchQuery} />
        : null}

      {isHome ? (
        <HomeScreen model={homeDashboard} />
      ) : (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          <ProjectsPanel
            ref={projectsRef}
            provider={provider}
            active={activeTab === "projects"}
            locked={Boolean(confirmState) || isHome}
            searchQuery={activeTab === "projects" ? searchQuery : ""}
            allSessions={allSessions}
            resourcePolicy={resourcePolicy}
            cmdSet={cmdSet}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onNavigateToSessions={handleNavigateToSessions}
          />
          <SessionsPanel
            ref={sessionsRef}
            provider={provider}
            active={activeTab === "sessions"}
            locked={Boolean(confirmState) || isHome || chatViewerOpen || chatSearchOpen}
            projectFilter={sessionFilter}
            searchQuery={activeTab === "sessions" ? searchQuery : ""}
            globalTokenSummary={globalTokens}
            allProjects={allProjects}
            allSessions={allSessions}
            resourcePolicy={resourcePolicy}
            cmdSet={cmdSet}
            onRefresh={() => setTokenRefreshKey((k) => k + 1)}
            onNotify={notify}
            requestConfirm={requestConfirm}
            onClearFilter={clearSessionFilter}
            onOpenChatViewer={openChatViewer}
          />
        </box>
      )}

      {/* Chat Viewer Overlay */}
      {chatViewerOpen && chatSession ? (
        <ChatViewer
          session={chatSession}
          messages={chatMessages}
          cursor={chatCursor}
          onCursorChange={setChatCursor}
          loading={chatLoading}
          error={chatError}
          onClose={closeChatViewer}
          onHydrateMessage={hydrateMessage}
          onCopyMessage={copyChatMessage}
        />
      ) : null}

      {/* Chat Search Overlay */}
      {chatSearchOpen ? (
        <OverlayFrame
          title={`Search Chat Content ${sessionFilter ? `(project: ${sessionFilter})` : "(all sessions)"}`}
          borderColor={PALETTE.info}
        >
          {/* Search input */}
          <box style={{ flexDirection: "row", marginBottom: 1 }}>
            <text fg={PALETTE.accent}>Search: </text>
            <text fg={PALETTE.key}>{chatSearchQuery}</text>
            <text fg={PALETTE.muted}>_</text>
            {chatSearching ? <text fg={PALETTE.info}> (searching...)</text> : null}
          </box>

          <box style={{ marginBottom: 1 }}>
            <text fg={PALETTE.muted}>
              Searching {sessionFilter ? allSessions.filter(s => s.projectId === sessionFilter).length : allSessions.length} sessions | Found: {chatSearchResults.length} matches
            </text>
          </box>

          {chatSearchResults.length === 0 && chatSearchQuery && !chatSearching ? (
            <text fg={PALETTE.muted}>No results found. Try a different search term.</text>
          ) : chatSearchResults.length > 0 ? (
            <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
              {/* Results list */}
              <box
                style={{
                  border: true,
                  borderColor: PALETTE.muted,
                  flexGrow: 4,
                  flexDirection: "column",
                  padding: 1,
                }}
                title="Results"
              >
                <select
                  options={chatSearchResults.map((r, idx) => ({
                    name: `${r.sessionTitle.slice(0, 25)} | ${r.role === "user" ? "[user]" : "[asst]"} ${r.matchedText.slice(0, 40)}...`,
                    description: "",
                    value: idx,
                  }))}
                  selectedIndex={chatSearchCursor}
                  onChange={setChatSearchCursor}
                  focused={true}
                  showScrollIndicator
                  wrapSelection={false}
                />
              </box>

              {/* Preview pane */}
              <box
                style={{
                  border: true,
                  borderColor: chatSearchResults[chatSearchCursor]?.role === "user" ? PALETTE.accent : PALETTE.primary,
                  flexGrow: 6,
                  flexDirection: "column",
                  padding: 1,
                  overflow: "hidden",
                }}
                title={chatSearchResults[chatSearchCursor] ? `${chatSearchResults[chatSearchCursor].role} message` : "Preview"}
              >
                {chatSearchResults[chatSearchCursor] ? (
                  <box style={{ flexDirection: "column" }}>
                    <box style={{ flexDirection: "row", marginBottom: 1 }}>
                      <text fg={PALETTE.accent}>Session: </text>
                      <text>{chatSearchResults[chatSearchCursor].sessionTitle}</text>
                    </box>
                    <box style={{ flexDirection: "row", marginBottom: 1 }}>
                      <text fg={PALETTE.accent}>Time: </text>
                      <text>{formatDate(chatSearchResults[chatSearchCursor].createdAt)}</text>
                      <text fg={PALETTE.muted}> | </text>
                      <text fg={PALETTE.accent}>Type: </text>
                      <text>{chatSearchResults[chatSearchCursor].partType}</text>
                    </box>
                    <box style={{ flexGrow: 1 }}>
                      <text>{chatSearchResults[chatSearchCursor].fullText.slice(0, 1500)}{chatSearchResults[chatSearchCursor].fullText.length > 1500 ? "\n[... truncated]" : ""}</text>
                    </box>
                  </box>
                ) : (
                  <text fg={PALETTE.muted}>Select a result to preview</text>
                )}
              </box>
            </box>
          ) : (
            <text fg={PALETTE.muted}>Type a search query and press Enter to search chat content.</text>
          )}

          {/* Footer */}
          <box style={{ marginTop: 1 }}>
            <text fg={PALETTE.muted}>
              Type query, Enter to search | Esc close | Up/Down navigate | Enter on result opens chat
            </text>
          </box>
        </OverlayFrame>
      ) : null}

      <StatusBar status={status} level={statusLevel} />
      {confirmState ? <ConfirmBar state={confirmState} busy={confirmBusy} /> : null}
    </box>
  )
}
