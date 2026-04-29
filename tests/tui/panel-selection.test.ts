import { describe, expect, test } from "bun:test"
import { clearSelection, toggleAllVisibleIndexes, toggleSelectedIndex } from "../../src/tui/panel-selection"

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
})
