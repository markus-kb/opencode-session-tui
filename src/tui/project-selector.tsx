import type { SelectOption } from "@opentui/core"
import { formatDisplayPath, type ProjectRecord } from "../lib/opencode-data"
import { PALETTE } from "./components"

export type ProjectSelectorProps = {
  projects: ProjectRecord[]
  cursor: number
  onCursorChange: (index: number) => void
  onSelect: (project: ProjectRecord) => void
  onCancel: () => void
  operationMode: "move" | "copy"
  sessionCount: number
}

export const ProjectSelector = ({
  projects,
  cursor,
  onCursorChange,
  onSelect,
  onCancel,
  operationMode,
  sessionCount,
}: ProjectSelectorProps) => {
  const options: SelectOption[] = projects.map((p, idx) => ({
    name: `${formatDisplayPath(p.worktree)} (${p.projectId})`,
    description: p.state,
    value: idx,
  }))

  return (
    <box
      title={`Select Target Project (${operationMode} ${sessionCount} session${sessionCount > 1 ? "s" : ""})`}
      style={{
        border: true,
        borderColor: operationMode === "move" ? PALETTE.key : PALETTE.accent,
        padding: 1,
        position: "absolute",
        top: 5,
        left: 5,
        right: 5,
        bottom: 5,
        zIndex: 100,
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
