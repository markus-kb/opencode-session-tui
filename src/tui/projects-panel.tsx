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
import { PALETTE } from "./components"
import type { ConfirmState } from "./confirm-bar"
import { formatTokenCount } from "./format"
import { toCommandKey, resolveCommand } from "./key-router"
import { clampCursor, clearSelection, getSelectedRecords, pruneSelectedIndexes, toggleAllVisibleIndexes, toggleSelectedIndex } from "./panel-selection"
import { toProjectPanelAction } from "./project-panel-commands"
import type { ResourcePolicy } from "./resource-policy"
import { computeProjectTokens } from "./token-resource"
import type { NotificationLevel } from "./status-bar"

export type PanelHandle = {
  handleKey: (key: KeyEvent) => void
  refresh: () => void
}

export type ProjectsPanelProps = {
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

const MAX_CONFIRM_PREVIEW = 5

export const ProjectsPanel = forwardRef<PanelHandle, ProjectsPanelProps>(function ProjectsPanel(
  { provider, active, locked, searchQuery, allSessions, resourcePolicy, cmdSet, onNotify, requestConfirm, onNavigateToSessions },
  ref,
) {
  const [records, setRecords] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingOnly, setMissingOnly] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
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
    setSelectedIndexes((prev) => pruneSelectedIndexes(prev, records.map((record) => record.index)))
  }, [records])

  useEffect(() => {
    setCursor((prev) => clampCursor(prev, visibleRecords.length))
  }, [visibleRecords.length])

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
      title: `Delete ${selectedRecords.length} project metadata entr${selectedRecords.length === 1 ? "y" : "ies"}?`,
      details: selectedRecords
        .slice(0, MAX_CONFIRM_PREVIEW)
        .map((record) => describeProject(record, { fullPath: true })),
      onConfirm: async () => {
        const { removed, failed } = await provider.deleteProjectMetadata(selectedRecords)
        setSelectedIndexes(clearSelection())
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
      const action = toProjectPanelAction(cmdId)
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
