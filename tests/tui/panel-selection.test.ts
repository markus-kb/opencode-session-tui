import { describe, expect, test } from "bun:test"
import { clampCursor, clearSelection, pruneSelectedIndexes, toggleAllVisibleIndexes, toggleSelectedIndex } from "../../src/tui/panel-selection"

describe("panel selection helpers", () => {
  test("toggles one selected index", () => {
    expect([...toggleSelectedIndex(new Set(), 2)]).toEqual([2])
    expect([...toggleSelectedIndex(new Set([2]), 2)]).toEqual([])
  })

  test("returns original selection when toggling a missing index", () => {
    const selected = new Set([1])
    expect(toggleSelectedIndex(selected, undefined)).toEqual(selected)
  })

  test("selects all visible indexes when not all visible are selected", () => {
    expect([...toggleAllVisibleIndexes(new Set([3]), [1, 2])].sort()).toEqual([1, 2, 3])
  })

  test("clears visible indexes when all visible are already selected", () => {
    expect([...toggleAllVisibleIndexes(new Set([1, 2, 3]), [1, 2])]).toEqual([3])
  })

  test("clears all selection", () => {
    expect([...clearSelection()]).toEqual([])
  })

  test("prunes selected indexes that are no longer valid", () => {
    expect([...pruneSelectedIndexes(new Set([1, 2, 3]), [1, 3])]).toEqual([1, 3])
  })

  test("returns the same set when no pruning is needed", () => {
    const selected = new Set([1, 3])
    expect(pruneSelectedIndexes(selected, [1, 2, 3])).toBe(selected)
  })

  test("returns the same empty set when selection is empty", () => {
    const selected = new Set<number>()
    expect(pruneSelectedIndexes(selected, [1, 2, 3])).toBe(selected)
  })

  test("clamps cursor to zero when there are no visible rows", () => {
    expect(clampCursor(3, 0)).toBe(0)
  })

  test("clamps cursor to last visible row", () => {
    expect(clampCursor(5, 3)).toBe(2)
  })

  test("keeps cursor when already in bounds", () => {
    expect(clampCursor(1, 3)).toBe(1)
  })
})
