import { describe, expect, test } from "bun:test"
import {
  closeOverlay,
  createInitialTuiState,
  openChatSearchOverlay,
  openChatViewerOverlay,
  openWorkspace,
} from "../../src/tui/app-state"
import {
  getResourcePolicy,
  isProjectMetadataEnabled,
  isSessionMetadataEnabled,
  isTokenSummaryEnabled,
  toWorkspaceDataLoadState,
} from "../../src/tui/resource-policy"

describe("TUI resource policy", () => {
  test("defers all expensive resources on home", () => {
    const policy = getResourcePolicy(createInitialTuiState())

    expect(policy).toEqual({
      projects: "deferred",
      sessions: "deferred",
      tokens: "deferred",
      chat: "deferred",
    })
    expect(isSessionMetadataEnabled(policy)).toBe(false)
    expect(isProjectMetadataEnabled(policy)).toBe(false)
    expect(isTokenSummaryEnabled(policy)).toBe(false)
    expect(toWorkspaceDataLoadState(policy)).toEqual({ enabled: false, reason: "home" })
  })

  test("enables metadata and token summaries after workspace entry", () => {
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "projects"))

    expect(policy).toEqual({
      projects: "metadata",
      sessions: "metadata",
      tokens: "summary",
      chat: "deferred",
    })
    expect(isSessionMetadataEnabled(policy)).toBe(true)
    expect(isProjectMetadataEnabled(policy)).toBe(true)
    expect(isTokenSummaryEnabled(policy)).toBe(true)
    expect(toWorkspaceDataLoadState(policy)).toEqual({ enabled: true })
  })

  test("uses chat index policy while the chat viewer overlay is active", () => {
    const state = openChatViewerOverlay(openWorkspace(createInitialTuiState(), "sessions"), "session-1")

    expect(getResourcePolicy(state).chat).toBe("index")
  })

  test("uses chat search policy while the chat search overlay is active", () => {
    const state = openChatSearchOverlay(openWorkspace(createInitialTuiState(), "sessions"))

    expect(getResourcePolicy(state).chat).toBe("search")
    expect(getResourcePolicy(closeOverlay(state)).chat).toBe("deferred")
  })

  test("keeps home cheap even if overlay state is present", () => {
    const state = openChatSearchOverlay(createInitialTuiState())

    expect(getResourcePolicy(state)).toEqual({
      projects: "deferred",
      sessions: "deferred",
      tokens: "deferred",
      chat: "deferred",
    })
  })
})
