import { describe, expect, test } from "bun:test"
import { buildTuiCommands } from "../../src/tui/command-definitions"
import { resolveProjectPanelInputAction } from "../../src/tui/projects-panel-input"

describe("projects panel input", () => {
  test("returns panel action only when panel is active and unlocked", () => {
    const cmdSet = buildTuiCommands()

    expect(resolveProjectPanelInputAction({ key: { name: "space", ctrl: false, meta: false }, active: true, locked: false, cmdSet })).toBe("toggleSelect")
    expect(resolveProjectPanelInputAction({ key: { name: "space", ctrl: false, meta: false }, active: false, locked: false, cmdSet })).toBeUndefined()
    expect(resolveProjectPanelInputAction({ key: { name: "space", ctrl: false, meta: false }, active: true, locked: true, cmdSet })).toBeUndefined()
  })
})
