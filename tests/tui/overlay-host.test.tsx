import { describe, expect, test } from "bun:test"
import { OverlayHost } from "../../src/tui/overlay-host"

describe("OverlayHost", () => {
  test("exports the overlay host component", () => {
    expect(typeof OverlayHost).toBe("function")
  })
})
