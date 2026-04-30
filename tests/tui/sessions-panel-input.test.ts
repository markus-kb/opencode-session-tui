import { describe, expect, test } from "bun:test"
import { buildTuiCommands } from "../../src/tui/command-definitions"
import { resolveSessionsPanelInputAction } from "../../src/tui/sessions-panel-input"

describe("sessions panel input", () => {
  test("resolves core panel actions when active and unlocked", () => {
    const cmdSet = buildTuiCommands()

    expect(resolveSessionsPanelInputAction({ key: { name: "space", ctrl: false, meta: false }, active: true, locked: false, cmdSet })).toBe("toggleSelect")
    expect(resolveSessionsPanelInputAction({ key: { sequence: "d", ctrl: false, meta: false }, active: true, locked: false, cmdSet })).toBe("deleteSelected")
    expect(resolveSessionsPanelInputAction({ key: { sequence: "c", ctrl: false, meta: false }, active: true, locked: false, cmdSet })).toBe("clearFilter")
  })

  test("does not resolve actions when inactive or locked", () => {
    const cmdSet = buildTuiCommands()

    expect(resolveSessionsPanelInputAction({ key: { sequence: "d", ctrl: false, meta: false }, active: false, locked: false, cmdSet })).toBeUndefined()
    expect(resolveSessionsPanelInputAction({ key: { sequence: "d", ctrl: false, meta: false }, active: true, locked: true, cmdSet })).toBeUndefined()
  })
})
