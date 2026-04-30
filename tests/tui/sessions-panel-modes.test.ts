import { describe, expect, test } from "bun:test"
import {
  cancelRenameMode,
  cancelTransferMode,
  getMoveTargetProjects,
  startRenameMode,
  startTransferMode,
} from "../../src/tui/sessions-panel-modes"

describe("sessions panel modes", () => {
  test("starts rename mode from current title", () => {
    expect(startRenameMode("Current title")).toEqual({
      isRenaming: true,
      renameValue: "Current title",
    })
  })

  test("cancels rename mode and clears buffer", () => {
    expect(cancelRenameMode()).toEqual({
      isRenaming: false,
      renameValue: "",
    })
  })

  test("starts transfer mode with reset cursor", () => {
    expect(startTransferMode("move")).toEqual({
      isSelectingProject: true,
      operationMode: "move",
      projectCursor: 0,
    })
  })

  test("cancels transfer mode", () => {
    expect(cancelTransferMode()).toEqual({
      isSelectingProject: false,
      operationMode: null,
    })
  })

  test("filters move targets to avoid current project", () => {
    const all = [
      { projectId: "project-a" },
      { projectId: "project-b" },
    ] as never

    expect(getMoveTargetProjects(all, "project-a").map((p) => p.projectId)).toEqual(["project-b"])
    expect(getMoveTargetProjects(all, null).map((p) => p.projectId)).toEqual(["project-a", "project-b"])
  })
})
