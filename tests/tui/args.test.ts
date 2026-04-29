import { describe, expect, test } from "bun:test"
import { getTuiKeyBindingUsage } from "../../src/tui/args"
import { buildTuiCommands } from "../../src/tui/command-definitions"

describe("TUI args usage", () => {
  test("generates keybinding usage from the command registry", () => {
    const usage = getTuiKeyBindingUsage(buildTuiCommands())

    expect(usage).toContain("Key bindings:")
    expect(usage).toContain("Global:")
    expect(usage).toContain("Projects:")
    expect(usage).toContain("Sessions:")
    expect(usage).toContain("Chat Viewer:")
    expect(usage).toContain("Chat Search:")
    expect(usage).toContain("Confirm:")
    expect(usage).toContain("q / C-c")
    expect(usage).toContain("Quit")
    expect(usage).toContain("space")
    expect(usage).toContain("Toggle selection")
    expect(usage).toContain("up")
    expect(usage).toContain("down")
    expect(usage).toContain("Previous result")
  })
})
