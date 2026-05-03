import { describe, it, expect } from "bun:test"
import { buildTuiCommands } from "../../src/tui/command-definitions"
import { resolveSessionsPanelInputAction } from "../../src/tui/sessions-panel-input"
import { resolveProjectPanelInputAction } from "../../src/tui/projects-panel-input"

// ---------------------------------------------------------------------------
// resolveSessionsPanelInputAction — pageUp / pageDown key routing
// ---------------------------------------------------------------------------

describe("resolveSessionsPanelInputAction — page navigation keys", () => {
  const cmdSet = buildTuiCommands()
  const active = true
  const locked = false

  it("pageup key resolves to 'pageUp' action", () => {
    expect(
      resolveSessionsPanelInputAction({
        key: { name: "pageup", ctrl: false, meta: false },
        active,
        locked,
        cmdSet,
      }),
    ).toBe("pageUp")
  })

  it("pagedown key resolves to 'pageDown' action", () => {
    expect(
      resolveSessionsPanelInputAction({
        key: { name: "pagedown", ctrl: false, meta: false },
        active,
        locked,
        cmdSet,
      }),
    ).toBe("pageDown")
  })

  it("pageup is ignored when panel is inactive", () => {
    expect(
      resolveSessionsPanelInputAction({
        key: { name: "pageup", ctrl: false, meta: false },
        active: false,
        locked: false,
        cmdSet,
      }),
    ).toBeUndefined()
  })

  it("pageup is ignored when panel is locked", () => {
    expect(
      resolveSessionsPanelInputAction({
        key: { name: "pageup", ctrl: false, meta: false },
        active: true,
        locked: true,
        cmdSet,
      }),
    ).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveProjectPanelInputAction — pageUp / pageDown key routing
// ---------------------------------------------------------------------------

describe("resolveProjectPanelInputAction — page navigation keys", () => {
  const cmdSet = buildTuiCommands()
  const active = true
  const locked = false

  it("pageup key resolves to 'pageUp' action", () => {
    expect(
      resolveProjectPanelInputAction({
        key: { name: "pageup", ctrl: false, meta: false },
        active,
        locked,
        cmdSet,
      }),
    ).toBe("pageUp")
  })

  it("pagedown key resolves to 'pageDown' action", () => {
    expect(
      resolveProjectPanelInputAction({
        key: { name: "pagedown", ctrl: false, meta: false },
        active,
        locked,
        cmdSet,
      }),
    ).toBe("pageDown")
  })
})
