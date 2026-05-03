import type { ProjectRecord } from "../lib/opencode-data"
import type { ProjectSortMode } from "./projects-panel"

export function sortProjectRecords(records: ProjectRecord[], mode: ProjectSortMode): ProjectRecord[] {
  if (mode === "alpha") {
    return [...records].sort((a, b) => a.worktree.localeCompare(b.worktree))
  }
  if (mode === "updated") {
    return [...records].sort((a, b) => {
      const aT = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0
      const bT = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0
      return bT - aT
    })
  }
  return [...records].sort((a, b) => {
    const aT = a.createdAt?.getTime() ?? 0
    const bT = b.createdAt?.getTime() ?? 0
    return bT - aT
  })
}
