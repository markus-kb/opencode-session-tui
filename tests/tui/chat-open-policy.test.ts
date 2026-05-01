import { describe, expect, test } from "bun:test"
import { createInitialTuiState, openWorkspace } from "../../src/tui/app-state"
import { policyForOpenChatSearch, policyForOpenChatViewer } from "../../src/tui/chat-open-policy"

describe("chat open policy", () => {
  test("enables chat index immediately when opening chat viewer", () => {
    const state = openWorkspace(createInitialTuiState(), "sessions")
    const policy = policyForOpenChatViewer(state, "session-1")

    expect(policy.chat).toBe("index")
  })

  test("enables chat search immediately when opening chat search", () => {
    const state = openWorkspace(createInitialTuiState(), "sessions")
    const policy = policyForOpenChatSearch(state)

    expect(policy.chat).toBe("search")
  })
})
