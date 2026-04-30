import { describe, expect, test } from "bun:test"
import { getWorkspaceReloadPlan } from "../../src/tui/workspace-reload"

describe("workspace reload", () => {
  test("targets projects panel when projects tab is active", () => {
    expect(getWorkspaceReloadPlan("projects")).toEqual({
      refreshTarget: "projects",
      status: "Reload requested...",
    })
  })

  test("targets sessions panel when sessions tab is active", () => {
    expect(getWorkspaceReloadPlan("sessions")).toEqual({
      refreshTarget: "sessions",
      status: "Reload requested...",
    })
  })
})
