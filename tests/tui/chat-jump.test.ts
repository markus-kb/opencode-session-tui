import { describe, expect, test } from "bun:test"
import type { ChatMessage } from "../../src/lib/opencode-data"
import { findNextUserMessage, findPrevUserMessage } from "../../src/tui/chat-jump"

function makeMsg(id: string, role: ChatMessage["role"]): ChatMessage {
  return {
    sessionId: "s",
    messageId: id,
    role,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    parts: null,
    previewText: id,
    totalChars: null,
  }
}

// list: U A A U A A  (indices 0,1,2,3,4,5)
const mixed = [
  makeMsg("0", "user"),
  makeMsg("1", "assistant"),
  makeMsg("2", "assistant"),
  makeMsg("3", "user"),
  makeMsg("4", "assistant"),
  makeMsg("5", "assistant"),
]

describe("findNextUserMessage", () => {
  test("finds next user message from middle", () => {
    expect(findNextUserMessage(mixed, 1)).toBe(3)
  })

  test("skips over multiple assistants to reach user", () => {
    expect(findNextUserMessage(mixed, 0)).toBe(3)
  })

  test("returns cursor unchanged when no further user message", () => {
    expect(findNextUserMessage(mixed, 3)).toBe(mixed.length - 1 < 3 ? 3 : 3)
    // from index 3 (user), next user doesn't exist → stays at 3
    expect(findNextUserMessage(mixed, 3)).toBe(3)
  })

  test("returns cursor unchanged when at last message", () => {
    expect(findNextUserMessage(mixed, 5)).toBe(5)
  })

  test("empty list returns cursor unchanged", () => {
    expect(findNextUserMessage([], 0)).toBe(0)
  })

  test("list with only assistants returns cursor unchanged", () => {
    const assistants = [makeMsg("a", "assistant"), makeMsg("b", "assistant")]
    expect(findNextUserMessage(assistants, 0)).toBe(0)
  })

  test("list with only user messages advances one step", () => {
    const users = [makeMsg("a", "user"), makeMsg("b", "user"), makeMsg("c", "user")]
    expect(findNextUserMessage(users, 0)).toBe(1)
    expect(findNextUserMessage(users, 1)).toBe(2)
    expect(findNextUserMessage(users, 2)).toBe(2)
  })
})

describe("findPrevUserMessage", () => {
  test("finds previous user message from middle", () => {
    expect(findPrevUserMessage(mixed, 4)).toBe(3)
  })

  test("finds previous user message skipping over assistants", () => {
    expect(findPrevUserMessage(mixed, 5)).toBe(3)
  })

  test("returns cursor unchanged when at first user message", () => {
    expect(findPrevUserMessage(mixed, 0)).toBe(0)
  })

  test("returns cursor unchanged when no earlier user message exists", () => {
    // [assistant, user]: from cursor=1 (user), no prior user → stay at 1
    const noEarlierUser = [makeMsg("a", "assistant"), makeMsg("b", "user")]
    expect(findPrevUserMessage(noEarlierUser, 1)).toBe(1)
    expect(findPrevUserMessage(noEarlierUser, 0)).toBe(0)
  })

  test("empty list returns cursor unchanged", () => {
    expect(findPrevUserMessage([], 0)).toBe(0)
  })

  test("list with only assistants returns cursor unchanged", () => {
    const assistants = [makeMsg("a", "assistant"), makeMsg("b", "assistant")]
    expect(findPrevUserMessage(assistants, 1)).toBe(1)
  })

  test("list with only user messages steps back one", () => {
    const users = [makeMsg("a", "user"), makeMsg("b", "user"), makeMsg("c", "user")]
    expect(findPrevUserMessage(users, 2)).toBe(1)
    expect(findPrevUserMessage(users, 1)).toBe(0)
    expect(findPrevUserMessage(users, 0)).toBe(0)
  })
})
