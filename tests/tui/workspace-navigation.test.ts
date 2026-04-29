import { describe, expect, test } from "bun:test"
import { getProjectSessionsNavigation } from "../../src/tui/workspace-navigation"

describe("workspace navigation", () => {
  test("describes project-to-session navigation", () => {
    expect(getProjectSessionsNavigation("project-a")).toEqual({
      activeTab: "sessions",
      sessionFilter: "project-a",
      status: "Filtering sessions by project-a",
    })
  })
})
