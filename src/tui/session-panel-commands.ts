export type SessionPanelAction =
  | "toggleSelect"
  | "selectAll"
  | "toggleSort"
  | "clearFilter"
  | "clearSelection"
  | "deleteSelected"
  | "copyId"
  | "renameSession"
  | "moveSessions"
  | "copySessions"
  | "viewChat"
  | "sessionInfo"

export function toSessionPanelAction(commandId: string | undefined): SessionPanelAction | undefined {
  switch (commandId) {
    case "sessions:toggleSelect":
      return "toggleSelect"
    case "sessions:selectAll":
      return "selectAll"
    case "sessions:toggleSort":
      return "toggleSort"
    case "sessions:clearFilter":
      return "clearFilter"
    case "sessions:clearSelection":
      return "clearSelection"
    case "sessions:deleteSelected":
      return "deleteSelected"
    case "sessions:copyId":
      return "copyId"
    case "sessions:renameSession":
      return "renameSession"
    case "sessions:moveSessions":
      return "moveSessions"
    case "sessions:copySessions":
      return "copySessions"
    case "sessions:viewChat":
      return "viewChat"
    case "sessions:sessionInfo":
      return "sessionInfo"
    default:
      return undefined
  }
}
