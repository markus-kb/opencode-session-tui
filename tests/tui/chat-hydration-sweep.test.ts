import { describe, expect, test } from "bun:test"
import type { ChatMessage } from "../../src/lib/opencode-data"
import { sweepUnhydratedMessages } from "../../src/tui/chat-session-resource"

function makeMsg(id: string, parts: ChatMessage["parts"]): ChatMessage {
  return {
    sessionId: "s1",
    messageId: id,
    role: "user",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    parts,
    previewText: parts === null ? "[loading...]" : "hello",
    totalChars: parts === null ? null : 5,
  }
}

describe("sweepUnhydratedMessages", () => {
  test("calls onHydrate for every message where parts is null", () => {
    const hydrated: string[] = []
    const msgs = [
      makeMsg("a", null),
      makeMsg("b", []),
      makeMsg("c", null),
    ]
    sweepUnhydratedMessages(msgs, (m) => hydrated.push(m.messageId))
    expect(hydrated).toEqual(["a", "c"])
  })

  test("does not call onHydrate when all messages are already hydrated", () => {
    let calls = 0
    const msgs = [makeMsg("a", []), makeMsg("b", [])]
    sweepUnhydratedMessages(msgs, () => { calls++ })
    expect(calls).toBe(0)
  })

  test("does nothing for an empty message list", () => {
    let calls = 0
    sweepUnhydratedMessages([], () => { calls++ })
    expect(calls).toBe(0)
  })

  test("calls onHydrate for all messages when all have parts null", () => {
    const hydrated: string[] = []
    const msgs = [makeMsg("x", null), makeMsg("y", null)]
    sweepUnhydratedMessages(msgs, (m) => hydrated.push(m.messageId))
    expect(hydrated).toEqual(["x", "y"])
  })
})
