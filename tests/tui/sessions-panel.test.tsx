import { describe, expect, test } from "bun:test"
import { SessionsPanel } from "../../src/tui/sessions-panel"

describe("SessionsPanel", () => {
  test("exports the sessions panel component", () => {
    expect(typeof SessionsPanel).toBe("object")
  })
})
