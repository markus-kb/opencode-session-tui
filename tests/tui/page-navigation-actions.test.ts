import { describe, it, expect } from "bun:test"
import { toSessionPanelAction } from "../../src/tui/session-panel-commands"
import { toProjectPanelAction } from "../../src/tui/project-panel-commands"

// ---------------------------------------------------------------------------
// Page navigation actions — RED tests
// ---------------------------------------------------------------------------

describe("toSessionPanelAction — page navigation", () => {
  it("maps sessions:pageUp to 'pageUp'", () => {
    expect(toSessionPanelAction("sessions:pageUp")).toBe("pageUp")
  })

  it("maps sessions:pageDown to 'pageDown'", () => {
    expect(toSessionPanelAction("sessions:pageDown")).toBe("pageDown")
  })

  it("unknown command still returns undefined", () => {
    expect(toSessionPanelAction("sessions:nonexistent")).toBeUndefined()
  })
})

describe("toProjectPanelAction — page navigation", () => {
  it("maps projects:pageUp to 'pageUp'", () => {
    expect(toProjectPanelAction("projects:pageUp")).toBe("pageUp")
  })

  it("maps projects:pageDown to 'pageDown'", () => {
    expect(toProjectPanelAction("projects:pageDown")).toBe("pageDown")
  })

  it("unknown command still returns undefined", () => {
    expect(toProjectPanelAction("projects:nonexistent")).toBeUndefined()
  })
})
