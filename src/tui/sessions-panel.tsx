import type { KeyEvent, SelectOption } from "@opentui/core"
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { copyToClipboardSync } from "../lib/clipboard"
import {
  type AggregateTokenSummary,
  type BatchOperationResult,
  describeSession,
  formatDate,
  formatDisplayPath,
  type ProjectRecord,
  type SessionRecord,
  type TokenSummary,
} from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import type { TuiCommandSet } from "./command-definitions"
import { PALETTE, ShortcutHints } from "./components"
import type { ConfirmState } from "./confirm-bar"
import { buildDeletionConfirmDetails, buildDeletionConfirmTitle } from "./confirm-payload"
import { formatAggregateSummaryShort, formatTokenCount } from "./format"
import { clampCursor, clearSelection, getSelectedRecords, pruneSelectedIndexes, toggleAllVisibleIndexes, toggleSelectedIndex } from "./panel-selection"
import { ProjectSelector } from "./project-selector"
import { closeProjectSelectorState, openProjectSelectorState } from "./project-selector-lifecycle"
import { filterSessionsByProject, reindexSessions } from "./project-resource"
import type { ResourcePolicy } from "./resource-policy"
import { resolveSessionsPanelInputAction } from "./sessions-panel-input"
import type { NotificationLevel } from "./status-bar"
import { computeFilteredProjectTokens, computeSessionTokens } from "./token-resource"
import type { PanelHandle } from "./projects-panel"
import { deriveVisibleSessions, type SessionSortMode } from "./sessions-panel-derive"
import { cancelRenameMode, getMoveTargetProjects, startRenameMode } from "./sessions-panel-modes"

export type SessionsPanelProps = {
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

export const SessionsPanel = forwardRef<PanelHandle, SessionsPanelProps>(function SessionsPanel(
  { provider, active, locked, projectFilter, searchQuery, globalTokenSummary, allProjects, allSessions, resourcePolicy, cmdSet, onRefresh, onNotify, requestConfirm, onClearFilter, onOpenChatViewer },
  ref,
) {
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [sortMode, setSortMode] = useState<SessionSortMode>("updated")
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isSelectingProject, setIsSelectingProject] = useState(false)
  const [operationMode, setOperationMode] = useState<'move' | 'copy' | null>(null)
  const [availableProjects, setAvailableProjects] = useState<ProjectRecord[]>([])
  const [projectCursor, setProjectCursor] = useState(0)
  const [currentTokenSummary, setCurrentTokenSummary] = useState<TokenSummary | null>(null)
  const [filteredTokenSummary, setFilteredTokenSummary] = useState<AggregateTokenSummary | null>(null)

  const records = useMemo(() => reindexSessions(filterSessionsByProject(allSessions, projectFilter || undefined)), [allSessions, projectFilter])

  const visibleRecords = useMemo(() => deriveVisibleSessions(records, searchQuery, sortMode), [records, searchQuery, sortMode])
  const currentSession = visibleRecords[cursor]

  useEffect(() => {
    setSelectedIndexes((prev) => pruneSelectedIndexes(prev, records.map((record) => record.index)))
  }, [records])

  useEffect(() => {
    setCursor(0)
  }, [projectFilter])

  useEffect(() => {
    setCursor((prev) => clampCursor(prev, visibleRecords.length))
  }, [visibleRecords.length])

  useEffect(() => {
    setCurrentTokenSummary(null)
    if (!currentSession) return
    let cancelled = false
    computeSessionTokens(provider, resourcePolicy, currentSession).then((summary) => {
      if (!cancelled && summary) setCurrentTokenSummary(summary)
    })
    return () => { cancelled = true }
  }, [currentSession, provider, resourcePolicy])

  useEffect(() => {
    setFilteredTokenSummary(null)
    if (records.length === 0) return
    let cancelled = false
    if (projectFilter) {
      computeFilteredProjectTokens(provider, resourcePolicy, projectFilter, records).then((summary) => {
        if (!cancelled && summary) setFilteredTokenSummary(summary)
      })
    }
    return () => { cancelled = true }
  }, [records, projectFilter, provider, resourcePolicy])

  const toggleSelection = useCallback((session: SessionRecord | undefined) => {
    setSelectedIndexes((prev) => toggleSelectedIndex(prev, session?.index))
  }, [])

  const selectedSessions = useMemo(
    () => getSelectedRecords(records, selectedIndexes, currentSession),
    [records, selectedIndexes, currentSession],
  )

  const selectOptions: SelectOption[] = useMemo(() => {
    return visibleRecords.map((session, idx) => {
      const selected = selectedIndexes.has(session.index)
      const prefix = selected ? "[*]" : "[ ]"
      const primary = session.title && session.title.trim().length > 0 ? session.title : session.sessionId
      const label = `${prefix} #${idx + 1} ${primary} (${session.version || "unknown"})`
      const stampBase = sortMode === "created" ? (session.createdAt ?? session.updatedAt) : (session.updatedAt ?? session.createdAt)
      const stamp = stampBase ? `${sortMode}: ${formatDate(stampBase)}` : `${sortMode}: ?`
      return { name: label, description: stamp, value: session.index }
    })
  }, [visibleRecords, selectedIndexes, sortMode])

  const requestDeletion = useCallback(() => {
    if (selectedSessions.length === 0) {
      onNotify("No sessions selected for deletion.", "error")
      return
    }
    requestConfirm({
      title: buildDeletionConfirmTitle(selectedSessions.length, "session entry"),
      details: buildDeletionConfirmDetails(selectedSessions, {
        maxPreview: MAX_CONFIRM_PREVIEW,
        describe: (session) => describeSession(session, { fullPath: true }),
      }),
      onConfirm: async () => {
        const { removed, failed } = await provider.deleteSessionMetadata(selectedSessions)
        setSelectedIndexes(clearSelection())
        const msg = failed.length ? `Removed ${removed.length} session file(s). Failed: ${failed.length}` : `Removed ${removed.length} session file(s).`
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

  const executeTransfer = useCallback(async (targetProject: ProjectRecord, mode: 'move' | 'copy') => {
    const closed = closeProjectSelectorState()
    setIsSelectingProject(closed.isSelectingProject)
    setOperationMode(closed.operationMode)

    const result = await runBatchSessionOperation(provider, selectedSessions, targetProject.projectId, mode)
    setSelectedIndexes(clearSelection())

    const successCount = result.succeeded.length
    const failCount = result.failed.length
    const verb = mode === 'move' ? 'moved' : 'copied'

    if (failCount === 0) {
      onNotify(`Successfully ${verb} ${successCount} session(s) to ${targetProject.projectId}`)
    } else {
      onNotify(`${verb} ${successCount} session(s), ${failCount} failed`, 'error')
    }

    onRefresh()
  }, [selectedSessions, provider, onNotify, onRefresh])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      if (!active || locked) return

      if (isSelectingProject) {
        if (key.name === 'escape') {
          const closed = closeProjectSelectorState()
          setIsSelectingProject(closed.isSelectingProject)
          setOperationMode(closed.operationMode)
          return
        }
        if (key.name === 'return' || key.name === 'enter') {
          const targetProject = availableProjects[projectCursor]
          if (targetProject && operationMode) void executeTransfer(targetProject, operationMode)
          return
        }
        return
      }

      if (isRenaming) {
        if (key.name === 'escape') {
          const next = cancelRenameMode()
          setIsRenaming(next.isRenaming)
          setRenameValue(next.renameValue)
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
        if (ch && ch.length === 1 && !key.ctrl && !key.meta) setRenameValue(prev => prev + ch)
        return
      }

      const action = resolveSessionsPanelInputAction({ key, active, locked, cmdSet })
      if (action === "toggleSelect") {
        key.preventDefault()
        toggleSelection(currentSession)
        return
      }
      if (action === "selectAll") {
        setSelectedIndexes((prev) => toggleAllVisibleIndexes(prev, visibleRecords.map((session) => session.index)))
        return
      }
      if (action === "toggleSort") {
        setSortMode((prev) => (prev === "updated" ? "created" : "updated"))
        return
      }
      if (action === "clearFilter") {
        if (projectFilter) onClearFilter()
        return
      }
      if (action === "clearSelection") {
        setSelectedIndexes(clearSelection())
        return
      }
      if (action === "deleteSelected") {
        requestDeletion()
        return
      }
      if (action === "copyId") {
        if (currentSession) {
          copyToClipboardSync(currentSession.sessionId)
          onNotify(`Copied ID ${currentSession.sessionId} to clipboard`)
        }
        return
      }
      if (action === "renameSession") {
        if (currentSession) {
          const next = startRenameMode(currentSession.title || '')
          setIsRenaming(next.isRenaming)
          setRenameValue(next.renameValue)
        }
        return
      }
      if (action === "moveSessions") {
        if (selectedSessions.length === 0) {
          onNotify('No sessions selected for move', 'error')
          return
        }
        const filtered = getMoveTargetProjects(allProjects, projectFilter)
        const next = openProjectSelectorState(filtered, "move")
        setAvailableProjects(next.availableProjects)
        setProjectCursor(next.projectCursor)
        setOperationMode(next.operationMode)
        setIsSelectingProject(next.isSelectingProject)
        return
      }
      if (action === "copySessions") {
        if (selectedSessions.length === 0) {
          onNotify('No sessions selected for copy', 'error')
          return
        }
        const next = openProjectSelectorState(allProjects, "copy")
        setAvailableProjects(next.availableProjects)
        setProjectCursor(next.projectCursor)
        setOperationMode(next.operationMode)
        setIsSelectingProject(next.isSelectingProject)
        return
      }
      if (action === "viewChat") {
        if (currentSession) onOpenChatViewer(currentSession)
        return
      }
      if (action === "sessionInfo") {
        if (currentSession) {
          const title = currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : currentSession.sessionId
          onNotify(`Session ${title} [${currentSession.sessionId}] -> ${formatDisplayPath(currentSession.directory)}`)
        }
      }
    },
    [active, locked, currentSession, projectFilter, onClearFilter, onNotify, requestDeletion, toggleSelection, isRenaming, executeRename, isSelectingProject, availableProjects, projectCursor, operationMode, executeTransfer, selectedSessions, allProjects, onOpenChatViewer, cmdSet, visibleRecords],
  )

  useImperativeHandle(ref, () => ({ handleKey, refresh: () => { onRefresh() } }), [handleKey, onRefresh])

  return (
    <box title="Sessions" style={{ border: true, borderColor: active ? "#22c55e" : "#374151", flexDirection: "column", flexGrow: active ? 6 : 4, padding: 1 }}>
      <box flexDirection="column" marginBottom={1}>
        <text>Filter: {projectFilter ? `project ${projectFilter.slice(0, 12)}…` : "none"} | Sort: {sortMode} | Sel: {selectedIndexes.size}{searchQuery ? ` | Search: ${searchQuery}` : ""}</text>
        <ShortcutHints
          prefix="Keys:"
          items={[
            { key: "Space", label: "select" },
            { key: "A", label: "select all" },
            { key: "S", label: "sort" },
            { key: "D", label: "delete" },
            { key: "Y", label: "copy ID" },
            { key: "V", label: "view chat" },
            { key: "F", label: "search chats" },
            { key: "Shift+R", label: "rename" },
            { key: "M", label: "move" },
            { key: "P", label: "copy" },
            { key: "C", label: "clear filter" },
            { key: "Esc", label: "clear" },
          ]}
        />
      </box>

      {isRenaming ? (
        <box style={{ border: true, borderColor: PALETTE.key, padding: 1, marginBottom: 1 }}>
          <box style={{ flexDirection: "row" }}>
            <text>Rename: </text>
            <text fg={PALETTE.key}>{renameValue}</text>
            <text fg={PALETTE.muted}> (</text>
            <text fg={PALETTE.key}>[Enter]</text>
            <text fg={PALETTE.muted}> confirm, </text>
            <text fg={PALETTE.key}>[Esc]</text>
            <text fg={PALETTE.muted}> cancel)</text>
          </box>
        </box>
      ) : null}

      {isSelectingProject && operationMode ? (
        <ProjectSelector
          projects={availableProjects}
          cursor={projectCursor}
          onCursorChange={setProjectCursor}
          onSelect={(project) => executeTransfer(project, operationMode)}
          onCancel={() => {
            const closed = closeProjectSelectorState()
            setIsSelectingProject(closed.isSelectingProject)
            setOperationMode(closed.operationMode)
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
                onNotify(`Session ${title} [${session.sessionId}] -> ${formatDisplayPath(session.directory)}`)
              }
            }}
            focused={active && !locked && !isSelectingProject && !isRenaming}
            showScrollIndicator
            showDescription={false}
            wrapSelection={false}
          />
          {currentSession ? (
            <box title="Details" style={{ border: true, marginTop: 1, paddingTop: 1, paddingLeft: 1, paddingRight: 1 }}>
              <text>Session: {currentSession.sessionId}  v{currentSession.version || "?"}</text>
              <text>Title: {currentSession.title && currentSession.title.trim().length > 0 ? currentSession.title : "(no title)"}</text>
              <text>Project: {currentSession.projectId}</text>
              <text>Updated: {formatDate(currentSession.updatedAt || currentSession.createdAt)}</text>
              <text>Directory: {formatDisplayPath(currentSession.directory, { fullPath: true })}</text>
              <box style={{ marginTop: 1, flexDirection: "column" }}>
                <text fg={PALETTE.accent}>Tokens:</text>
                {currentTokenSummary?.kind === 'known' ? (
                  <box style={{ flexDirection: "row" }}>
                    <box style={{ flexDirection: "column", marginRight: 2 }}>
                      <text>In:     {formatTokenCount(currentTokenSummary.tokens.input)}</text>
                      <text>Out:    {formatTokenCount(currentTokenSummary.tokens.output)}</text>
                      <text>Reason: {formatTokenCount(currentTokenSummary.tokens.reasoning)}</text>
                    </box>
                    <box style={{ flexDirection: "column" }}>
                      <text>Cache R: {formatTokenCount(currentTokenSummary.tokens.cacheRead)}</text>
                      <text>Cache W: {formatTokenCount(currentTokenSummary.tokens.cacheWrite)}</text>
                      <text fg={PALETTE.success}>Total:   {formatTokenCount(currentTokenSummary.tokens.total)}</text>
                    </box>
                  </box>
                ) : (
                  <text fg={PALETTE.muted}>{currentTokenSummary ? '?' : 'loading...'}</text>
                )}
              </box>
              {projectFilter && filteredTokenSummary ? (
                <box style={{ marginTop: 1 }}>
                  <text fg={PALETTE.info}>Filtered ({projectFilter.slice(0, 12)}…): </text>
                  <text>{formatAggregateSummaryShort(filteredTokenSummary)}</text>
                </box>
              ) : null}
              {globalTokenSummary ? (
                <box>
                  <text fg={PALETTE.primary}>Global: </text>
                  <text>{formatAggregateSummaryShort(globalTokenSummary)}</text>
                </box>
              ) : null}
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})
