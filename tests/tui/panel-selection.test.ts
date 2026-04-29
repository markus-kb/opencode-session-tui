import { describe, expect, test } from "bun:test"
import { clampCursor, clearSelection, getSelectedRecords, pruneSelectedIndexes, toggleAllVisibleIndexes, toggleSelectedIndex } from "../../src/tui/panel-selection"

type Row = { index: number; name: string }

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

  test("returns selected records when selection is non-empty", () => {
    const rows: Row[] = [
      { index: 1, name: "one" },
      { index: 2, name: "two" },
      { index: 3, name: "three" },
    ]

    expect(getSelectedRecords(rows, new Set([1, 3]), rows[1]).map(row => row.name)).toEqual(["one", "three"])
  })

  test("falls back to current record when selection is empty", () => {
    const rows: Row[] = [{ index: 1, name: "one" }]

    expect(getSelectedRecords(rows, new Set(), rows[0])).toEqual([rows[0]])
  })

  test("returns empty list when nothing is selected and current record is missing", () => {
    const rows: Row[] = [{ index: 1, name: "one" }]

    expect(getSelectedRecords(rows, new Set(), undefined)).toEqual([])
  })
})
