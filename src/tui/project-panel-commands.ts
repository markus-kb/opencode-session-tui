export type ProjectPanelAction =
  | "toggleSelect"
  | "toggleMissing"
  | "selectAll"
  | "clearSelection"
  | "deleteSelected"
  | "navigateToSessions"

export function toProjectPanelAction(commandId: string | undefined): ProjectPanelAction | undefined {
  switch (commandId) {
    case "projects:toggleSelect":
      return "toggleSelect"
    case "projects:toggleMissing":
      return "toggleMissing"
    case "projects:selectAll":
      return "selectAll"
    case "projects:clearSelection":
      return "clearSelection"
    case "projects:deleteSelected":
      return "deleteSelected"
    case "projects:navigateToSessions":
      return "navigateToSessions"
    default:
      return undefined
  }
}
