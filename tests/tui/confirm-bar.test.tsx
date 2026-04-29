import { describe, expect, test } from "bun:test"
import { ConfirmBar } from "../../src/tui/confirm-bar"

describe("ConfirmBar", () => {
  test("exports the confirmation bar component", () => {
    expect(typeof ConfirmBar).toBe("function")
  })
})
