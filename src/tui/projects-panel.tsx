import type { KeyEvent, SelectOption } from "@opentui/core"
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import {
  type AggregateTokenSummary,
  describeProject,
  formatDate,
  formatDisplayPath,
  type ProjectRecord,
  type SessionRecord,
} from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import { type TuiCommandSet } from "./command-definitions"
import { PALETTE, ShortcutHints } from "./components"
import type { ConfirmState } from "./confirm-bar"
import { buildDeletionConfirmDetails, buildDeletionConfirmTitle } from "./confirm-payload"
import { formatTokenCount } from "./format"
import { clampCursor, clearSelection, getSelectedRecords, pruneSelectedIndexes, toggleAllVisibleIndexes, toggleSelectedIndex } from "./panel-selection"
import { resolveProjectPanelInputAction } from "./projects-panel-input"
import type { ResourcePolicy } from "./resource-policy"
import { computeProjectTokens } from "./token-resource"
import type { NotificationLevel } from "./status-bar"

export type PanelHandle = {
  handleKey: (key: KeyEvent) => void
  refresh: () => void
}

export type ProjectSortMode = "alpha" | "created" | "updated"

const SORT_MODE_CYCLE: ProjectSortMode[] = ["created", "alpha", "updated"]

export type ProjectsPanelProps = {
  provider: DataProvider
  active: boolean
  locked: boolean
  searchQuery: string
  allProjects: ProjectRecord[]
  projectIndexLoaded: boolean
  allSessions: SessionRecord[]
  resourcePolicy: ResourcePolicy
  cmdSet: TuiCommandSet
  onRefresh: () => void
  onNotify: (message: string, level?: NotificationLevel) => void
  requestConfirm: (state: ConfirmState) => void
  onNavigateToSessions: (projectId: string) => void
  onProjectCursorChange?: (projectId: string | null) => void
}

const MAX_CONFIRM_PREVIEW = 5

export const getProjectsPanelRecords = (allProjects: ProjectRecord[]): ProjectRecord[] => allProjects

export const ProjectsPanel = forwardRef<PanelHandle, ProjectsPanelProps>(function ProjectsPanel(
  { provider, active, locked, searchQuery, allProjects, projectIndexLoaded, allSessions, resourcePolicy, cmdSet, onRefresh, onNotify, requestConfirm, onNavigateToSessions, onProjectCursorChange },
  ref,
) {
  const [missingOnly, setMissingOnly] = useState(false)
  const [sortMode, setSortMode] = useState<ProjectSortMode>("created")
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [currentProjectTokens, setCurrentProjectTokens] = useState<AggregateTokenSummary | null>(null)

  const projectLastUpdated = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of allSessions) {
      const t = s.updatedAt?.getTime() ?? s.createdAt?.getTime() ?? 0
      const prev = map.get(s.projectId) ?? 0
      if (t > prev) map.set(s.projectId, t)
    }
    return map
  }, [allSessions])

  const records = useMemo(() => {
    const base = getProjectsPanelRecords(allProjects)
    if (sortMode === "alpha") {
      return [...base].sort((a, b) => a.projectId.localeCompare(b.projectId))
    }
    if (sortMode === "updated") {
      return [...base].sort((a, b) => {
        const aT = projectLastUpdated.get(a.projectId) ?? a.createdAt?.getTime() ?? 0
        const bT = projectLastUpdated.get(b.projectId) ?? b.createdAt?.getTime() ?? 0
        return bT - aT
      })
    }
    return base
  }, [allProjects, sortMode, projectLastUpdated])

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

  useEffect(() => {
    setSelectedIndexes((prev) => pruneSelectedIndexes(prev, records.map((record) => record.index)))
  }, [records])

  useEffect(() => {
    setCursor((prev) => clampCursor(prev, visibleRecords.length))
  }, [visibleRecords.length])

  useEffect(() => {
    onProjectCursorChange?.(currentRecord?.projectId ?? null)
  }, [currentRecord, onProjectCursorChange])

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
    setSelectedIndexes((prev) => toggleSelectedIndex(prev, record?.index))
  }, [])

  const selectedRecords = useMemo(
    () => getSelectedRecords(records, selectedIndexes, currentRecord),
    [records, selectedIndexes, currentRecord],
  )

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
      title: buildDeletionConfirmTitle(selectedRecords.length, "project metadata entry"),
      details: buildDeletionConfirmDetails(selectedRecords, {
        maxPreview: MAX_CONFIRM_PREVIEW,
        describe: (record) => describeProject(record, { fullPath: true }),
      }),
      onConfirm: async () => {
        const { removed, failed } = await provider.deleteProjectMetadata(selectedRecords)
        setSelectedIndexes(clearSelection())
        const msg = failed.length
          ? `Removed ${removed.length} project file(s). Failed: ${failed.length}`
          : `Removed ${removed.length} project file(s).`
        onNotify(msg, failed.length ? "error" : "info")
        onRefresh()
      },
    })
  }, [selectedRecords, onNotify, requestConfirm, onRefresh, provider])

  const handleKey = useCallback(
    (key: KeyEvent) => {
      const action = resolveProjectPanelInputAction({ key, active, locked, cmdSet })
      if (action === "toggleSelect") {
        key.preventDefault()
        toggleSelection(currentRecord)
        return
      }
      if (action === "toggleMissing") {
        setMissingOnly((prev) => !prev)
        setCursor(0)
        return
      }
      if (action === "selectAll") {
        setSelectedIndexes((prev) => toggleAllVisibleIndexes(prev, visibleRecords.map((record) => record.index)))
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
      if (action === "navigateToSessions") {
        if (currentRecord) {
          onNavigateToSessions(currentRecord.projectId)
        }
        return
      }
      if (action === "cycleSortMode") {
        setSortMode((prev) => {
          const idx = SORT_MODE_CYCLE.indexOf(prev)
          return SORT_MODE_CYCLE[(idx + 1) % SORT_MODE_CYCLE.length]
        })
        setCursor(0)
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
        onRefresh()
      },
    }),
    [handleKey, onRefresh],
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
        <text>Filter: {missingOnly ? "missing only" : "all"} | Sort: {sortMode}</text>
        <text>
          Total: {records.length} | Missing: {missingCount} | Selected: {selectedIndexes.size}
        </text>
        <ShortcutHints
          prefix="Keys:"
          items={[
            { key: "Space", label: "select" },
            { key: "A", label: "select all" },
            { key: "M", label: "toggle missing" },
            { key: "S", label: "sort" },
            { key: "D", label: "delete" },
            { key: "Enter", label: "view sessions" },
            { key: "Esc", label: "clear" },
          ]}
        />
      </box>

      {!projectIndexLoaded ? (
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
            <box title="Details" style={{ border: true, marginTop: 1, paddingTop: 1, paddingLeft: 1, paddingRight: 1 }}>
              <text>Project: {currentRecord.projectId}  State: {currentRecord.state}</text>
              <text>Bucket: {currentRecord.bucket}  VCS: {currentRecord.vcs || "-"}</text>
              <text>Created: {currentRecord.createdAt ? formatDate(currentRecord.createdAt) : "unknown"}</text>
              <text>Path: {formatDisplayPath(currentRecord.worktree, { fullPath: true })}</text>
              <box style={{ marginTop: 1 }}>
                <text fg={PALETTE.accent}>Tokens: </text>
                {currentProjectTokens?.total.kind === "known" ? (
                  <>
                    <text fg={PALETTE.success}>Total: {formatTokenCount(currentProjectTokens.total.tokens.total)}</text>
                    {currentProjectTokens.unknownSessions && currentProjectTokens.unknownSessions > 0 ? (
                      <text fg={PALETTE.muted}> (+{currentProjectTokens.unknownSessions} unknown sessions)</text>
                    ) : null}
                  </>
                ) : (
                  <text fg={PALETTE.muted}>{currentProjectTokens ? "?" : "loading..."}</text>
                )}
              </box>
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
})
