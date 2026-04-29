import { describe, expect, test } from "bun:test"
import { getProjectsPanelRecords, ProjectsPanel } from "../../src/tui/projects-panel"

describe("ProjectsPanel", () => {
  test("exports the projects panel component", () => {
    expect(typeof ProjectsPanel).toBe("object")
  })

  test("uses the shared root project index as panel records", () => {
    const records = [{ projectId: "proj-a", index: 1 }]

    expect(getProjectsPanelRecords(records as never)).toBe(records)
  })
})
