import { describe, expect, test } from "bun:test"
import { Bullet, Columns, KeyChip, OverlayFrame, Row, SearchBar, Section } from "../../src/tui/components"

describe("TUI shared components", () => {
  test("exports layout primitives used by screens and panels", () => {
    expect(typeof Section).toBe("function")
    expect(typeof Row).toBe("function")
    expect(typeof OverlayFrame).toBe("function")
    expect(typeof Bullet).toBe("function")
    expect(typeof Columns).toBe("function")
    expect(typeof KeyChip).toBe("function")
    expect(typeof SearchBar).toBe("function")
  })
})
