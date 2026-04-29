import { describe, expect, test } from "bun:test"
import { toProjectPanelAction } from "../../src/tui/project-panel-commands"

describe("project panel commands", () => {
  test("maps project command ids to panel actions", () => {
    expect(toProjectPanelAction("projects:toggleSelect")).toBe("toggleSelect")
    expect(toProjectPanelAction("projects:toggleMissing")).toBe("toggleMissing")
    expect(toProjectPanelAction("projects:selectAll")).toBe("selectAll")
    expect(toProjectPanelAction("projects:clearSelection")).toBe("clearSelection")
    expect(toProjectPanelAction("projects:deleteSelected")).toBe("deleteSelected")
    expect(toProjectPanelAction("projects:navigateToSessions")).toBe("navigateToSessions")
  })

  test("ignores non-project commands", () => {
    expect(toProjectPanelAction(undefined)).toBeUndefined()
    expect(toProjectPanelAction("quit")).toBeUndefined()
    expect(toProjectPanelAction("sessions:deleteSelected")).toBeUndefined()
  })
})
