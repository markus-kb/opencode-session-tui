import { describe, expect, test } from "bun:test"
import type { ChatMessage, ChatSearchResult, SessionRecord } from "../../src/lib/opencode-data"
import { findMessageCursorById, findSessionForChatSearchResult } from "../../src/tui/chat-search-navigation"

describe("chat search navigation", () => {
  test("finds target session for a chat search result", () => {
    const sessions = [
      { sessionId: "s-1" },
      { sessionId: "s-2" },
    ] as SessionRecord[]
    const result = { sessionId: "s-2" } as ChatSearchResult

    expect(findSessionForChatSearchResult(sessions, result)).toBe(sessions[1])
  })

  test("returns null when target session is missing", () => {
    const sessions = [{ sessionId: "s-1" }] as SessionRecord[]
    const result = { sessionId: "s-2" } as ChatSearchResult

    expect(findSessionForChatSearchResult(sessions, result)).toBeNull()
  })

  test("locates message cursor by message id", () => {
    const messages = [
      { messageId: "m-1" },
      { messageId: "m-2" },
    ] as ChatMessage[]

    expect(findMessageCursorById(messages, "m-2")).toBe(1)
    expect(findMessageCursorById(messages, "missing")).toBeNull()
  })
})
