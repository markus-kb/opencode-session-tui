import { describe, expect, test } from "bun:test"
import { toSessionPanelAction } from "../../src/tui/session-panel-commands"

describe("session panel commands", () => {
  test("maps session command ids to panel actions", () => {
    expect(toSessionPanelAction("sessions:toggleSelect")).toBe("toggleSelect")
    expect(toSessionPanelAction("sessions:selectAll")).toBe("selectAll")
    expect(toSessionPanelAction("sessions:toggleSort")).toBe("toggleSort")
    expect(toSessionPanelAction("sessions:clearFilter")).toBe("clearFilter")
    expect(toSessionPanelAction("sessions:clearSelection")).toBe("clearSelection")
    expect(toSessionPanelAction("sessions:deleteSelected")).toBe("deleteSelected")
    expect(toSessionPanelAction("sessions:copyId")).toBe("copyId")
    expect(toSessionPanelAction("sessions:renameSession")).toBe("renameSession")
    expect(toSessionPanelAction("sessions:moveSessions")).toBe("moveSessions")
    expect(toSessionPanelAction("sessions:copySessions")).toBe("copySessions")
    expect(toSessionPanelAction("sessions:viewChat")).toBe("viewChat")
    expect(toSessionPanelAction("sessions:sessionInfo")).toBe("sessionInfo")
  })

  test("ignores non-session commands", () => {
    expect(toSessionPanelAction(undefined)).toBeUndefined()
    expect(toSessionPanelAction("quit")).toBeUndefined()
    expect(toSessionPanelAction("projects:deleteSelected")).toBeUndefined()
  })
})
