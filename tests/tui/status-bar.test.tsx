import { describe, expect, test } from "bun:test"
import { StatusBar } from "../../src/tui/status-bar"

describe("StatusBar", () => {
  test("exports the status bar component", () => {
    expect(typeof StatusBar).toBe("function")
  })
})
