import { describe, expect, test } from "bun:test"
import type { ChatMessage } from "../../src/lib/opencode-data"
import { upsertHydratedMessage } from "../../src/tui/chat-memory-policy"

function hydrated(id: string): ChatMessage {
  return {
    sessionId: "s1",
    messageId: id,
    role: "assistant",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    parts: [{ partId: `p-${id}`, messageId: id, type: "text", text: `message ${id}` }],
    previewText: `preview ${id}`,
    totalChars: 10,
  }
}

describe("chat memory policy", () => {
  test("evicts oldest entries when capacity exceeded", () => {
    let cache = new Map<string, ChatMessage>()
    cache = upsertHydratedMessage(cache, "m1", hydrated("m1"), 2)
    cache = upsertHydratedMessage(cache, "m2", hydrated("m2"), 2)
    cache = upsertHydratedMessage(cache, "m3", hydrated("m3"), 2)

    expect([...cache.keys()]).toEqual(["m2", "m3"])
  })

  test("refreshes recency when existing message is updated", () => {
    let cache = new Map<string, ChatMessage>()
    cache = upsertHydratedMessage(cache, "m1", hydrated("m1"), 3)
    cache = upsertHydratedMessage(cache, "m2", hydrated("m2"), 3)
    cache = upsertHydratedMessage(cache, "m1", hydrated("m1"), 3)

    expect([...cache.keys()]).toEqual(["m2", "m1"])
  })

  test("returns a new map without mutating input", () => {
    const original = new Map<string, ChatMessage>()
    const next = upsertHydratedMessage(original, "m1", hydrated("m1"), 3)

    expect(original.size).toBe(0)
    expect(next.size).toBe(1)
  })
})
