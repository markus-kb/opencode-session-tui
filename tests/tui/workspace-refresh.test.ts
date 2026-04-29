import { describe, expect, test } from "bun:test"
import { nextWorkspaceRefreshKey } from "../../src/tui/workspace-refresh"

describe("workspace refresh", () => {
  test("increments the refresh key through one shared helper", () => {
    expect(nextWorkspaceRefreshKey(0)).toBe(1)
    expect(nextWorkspaceRefreshKey(41)).toBe(42)
  })
})
