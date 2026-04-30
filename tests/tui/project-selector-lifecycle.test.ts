import { describe, expect, test } from "bun:test"
import {
  closeProjectSelectorState,
  openProjectSelectorState,
} from "../../src/tui/project-selector-lifecycle"

describe("project selector lifecycle", () => {
  test("opens selector with prepared projects and reset cursor", () => {
    const projects = [{ projectId: "a" }, { projectId: "b" }] as never

    expect(openProjectSelectorState(projects, "move")).toEqual({
      availableProjects: projects,
      projectCursor: 0,
      operationMode: "move",
      isSelectingProject: true,
    })
  })

  test("closes selector and clears operation mode", () => {
    expect(closeProjectSelectorState()).toEqual({
      isSelectingProject: false,
      operationMode: null,
    })
  })
})
