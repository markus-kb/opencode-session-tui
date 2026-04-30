import type { ProjectRecord } from "../lib/opencode-data"

export type TransferMode = "move" | "copy"

export function startRenameMode(currentTitle: string): {
  isRenaming: true
  renameValue: string
} {
  return {
    isRenaming: true,
    renameValue: currentTitle,
  }
}

export function cancelRenameMode(): {
  isRenaming: false
  renameValue: ""
} {
  return {
    isRenaming: false,
    renameValue: "",
  }
}

export function startTransferMode(mode: TransferMode): {
  isSelectingProject: true
  operationMode: TransferMode
  projectCursor: 0
} {
  return {
    isSelectingProject: true,
    operationMode: mode,
    projectCursor: 0,
  }
}

export function cancelTransferMode(): {
  isSelectingProject: false
  operationMode: null
} {
  return {
    isSelectingProject: false,
    operationMode: null,
  }
}

export function getMoveTargetProjects(
  allProjects: ProjectRecord[],
  projectFilter: string | null,
): ProjectRecord[] {
  return projectFilter
    ? allProjects.filter((project) => project.projectId !== projectFilter)
    : allProjects
}
