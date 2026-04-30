import type { ProjectRecord } from "../lib/opencode-data"
import type { TransferMode } from "./sessions-panel-modes"

export function openProjectSelectorState(
  availableProjects: ProjectRecord[],
  mode: TransferMode,
): {
  availableProjects: ProjectRecord[]
  projectCursor: 0
  operationMode: TransferMode
  isSelectingProject: true
} {
  return {
    availableProjects,
    projectCursor: 0,
    operationMode: mode,
    isSelectingProject: true,
  }
}

export function closeProjectSelectorState(): {
  isSelectingProject: false
  operationMode: null
} {
  return {
    isSelectingProject: false,
    operationMode: null,
  }
}
