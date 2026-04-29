import { describe, expect, test } from "bun:test"
import type { ChatMessage } from "../../src/lib/opencode-data"
import type { DataProvider } from "../../src/lib/opencode-data-provider"
import { getFailedHydrationMessage, loadChatSessionMessages, hydrateChatSessionMessage } from "../../src/tui/chat-session-resource"
import type { ResourcePolicy } from "../../src/tui/resource-policy"

const chatPolicy: ResourcePolicy = { projects: "metadata", sessions: "metadata", tokens: "summary", chat: "index" }
const deferredPolicy: ResourcePolicy = { projects: "metadata", sessions: "metadata", tokens: "summary", chat: "deferred" }

const message: ChatMessage = {
  sessionId: "session-a",
  messageId: "message-a",
  role: "user",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  parts: [],
  previewText: "hello",
  totalChars: 5,
}

describe("chat session resource", () => {
  test("defers chat message loading when chat index is disabled", async () => {
    let calls = 0
    const provider = {
      loadSessionChatIndex: async () => {
        calls++
        return [message]
      },
    } as unknown as DataProvider

    await expect(loadChatSessionMessages(provider, deferredPolicy, "session-a")).resolves.toEqual({ kind: "deferred", messages: [] })
    expect(calls).toBe(0)
  })

  test("loads chat message index when enabled", async () => {
    const provider = {
      loadSessionChatIndex: async (sessionId: string) => sessionId === "session-a" ? [message] : [],
    } as unknown as DataProvider

    await expect(loadChatSessionMessages(provider, chatPolicy, "session-a")).resolves.toEqual({ kind: "loaded", messages: [message] })
  })

  test("hydrates messages through the provider", async () => {
    const hydrated = { ...message, totalChars: 10 }
    const provider = {
      hydrateChatMessageParts: async () => hydrated,
    } as unknown as DataProvider

    await expect(hydrateChatSessionMessage(provider, chatPolicy, message)).resolves.toBe(hydrated)
  })

  test("creates a failed hydration placeholder", () => {
    expect(getFailedHydrationMessage(message)).toMatchObject({
      messageId: "message-a",
      parts: [],
      previewText: "[failed to load]",
      totalChars: 0,
    })
  })
})
