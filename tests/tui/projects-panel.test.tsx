import { describe, expect, test } from "bun:test"
import { ProjectsPanel } from "../../src/tui/projects-panel"

describe("ProjectsPanel", () => {
  test("exports the projects panel component", () => {
    expect(typeof ProjectsPanel).toBe("object")
  })
})
