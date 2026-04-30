import { describe, expect, test } from "bun:test"
import { executeWorkspaceReload } from "../../src/tui/workspace-reload-execute"

describe("workspace reload execute", () => {
  test("clears token cache and refreshes projects target", () => {
    const calls: string[] = []

    executeWorkspaceReload({
      refreshTarget: "projects",
      status: "Reload requested...",
      clearTokenCache: () => calls.push("clear"),
      refreshWorkspaceResources: () => calls.push("refreshResources"),
      refreshProjectsPanel: () => calls.push("refreshProjects"),
      refreshSessionsPanel: () => calls.push("refreshSessions"),
      notify: (message) => calls.push(`notify:${message}`),
    })

    expect(calls).toEqual([
      "clear",
      "refreshResources",
      "refreshProjects",
      "notify:Reload requested...",
    ])
  })

  test("clears token cache and refreshes sessions target", () => {
    const calls: string[] = []

    executeWorkspaceReload({
      refreshTarget: "sessions",
      status: "Reload requested...",
      clearTokenCache: () => calls.push("clear"),
      refreshWorkspaceResources: () => calls.push("refreshResources"),
      refreshProjectsPanel: () => calls.push("refreshProjects"),
      refreshSessionsPanel: () => calls.push("refreshSessions"),
      notify: (message) => calls.push(`notify:${message}`),
    })

    expect(calls).toEqual([
      "clear",
      "refreshResources",
      "refreshSessions",
      "notify:Reload requested...",
    ])
  })
})
