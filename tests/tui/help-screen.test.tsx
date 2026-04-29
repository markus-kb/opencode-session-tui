import { describe, expect, test } from "bun:test"
import { HelpScreen } from "../../src/tui/help-screen"

describe("HelpScreen", () => {
  test("exports the registry-backed help screen component", () => {
    expect(typeof HelpScreen).toBe("function")
  })
})
