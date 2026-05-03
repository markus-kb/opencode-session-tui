import { describe, it, expect } from "bun:test"
import { wrapCursor, clampCursor } from "../../src/tui/panel-selection"

// ---------------------------------------------------------------------------
// wrapCursor — cursor navigation with wrap-around
//
// Used by both Projects and Sessions panels so that pressing up at index 0
// jumps to the last item, and pressing down at the last item jumps to index 0.
// ---------------------------------------------------------------------------
describe("wrapCursor", () => {
  it("returns the same index when within bounds", () => {
    expect(wrapCursor(2, 5)).toBe(2)
  })

  it("wraps from 0 to last index when going negative (up at top)", () => {
    // cursor - 1 would be -1 → wraps to 4 (last index for count=5)
    expect(wrapCursor(-1, 5)).toBe(4)
  })

  it("wraps from last index to 0 when exceeding count (down at bottom)", () => {
    expect(wrapCursor(5, 5)).toBe(0)
  })

  it("returns 0 when visibleCount is 0", () => {
    expect(wrapCursor(0, 0)).toBe(0)
    expect(wrapCursor(-1, 0)).toBe(0)
  })

  it("wraps correctly for a single-item list", () => {
    expect(wrapCursor(0, 1)).toBe(0)
    expect(wrapCursor(-1, 1)).toBe(0)
    expect(wrapCursor(1, 1)).toBe(0)
  })

  it("handles large over-bounds values (multiple wraps)", () => {
    // Should be equivalent to index % count
    expect(wrapCursor(7, 5)).toBe(2)
  })
})

// Existing clampCursor is unaffected — confirm no regression
describe("clampCursor (regression)", () => {
  it("clamps to last valid index", () => {
    expect(clampCursor(10, 5)).toBe(4)
    expect(clampCursor(0, 5)).toBe(0)
    expect(clampCursor(0, 0)).toBe(0)
  })
})
