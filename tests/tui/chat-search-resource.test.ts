import { describe, expect, test } from "bun:test"
import type { ChatSearchResult, SessionRecord } from "../../src/lib/opencode-data"
import type { DataProvider } from "../../src/lib/opencode-data-provider"
import { getChatSearchSessions, searchChatSessions } from "../../src/tui/chat-search-resource"
import type { ResourcePolicy } from "../../src/tui/resource-policy"

const searchPolicy: ResourcePolicy = { projects: "metadata", sessions: "metadata", tokens: "summary", chat: "search" }
const deferredPolicy: ResourcePolicy = { projects: "metadata", sessions: "metadata", tokens: "summary", chat: "deferred" }

const sessions = [
  { sessionId: "a", projectId: "project-a" },
  { sessionId: "b", projectId: "project-b" },
] as SessionRecord[]

const result = { sessionId: "a", messageId: "m1" } as ChatSearchResult

describe("chat search resource", () => {
  test("filters sessions by active project filter", () => {
    expect(getChatSearchSessions(sessions, "project-a")).toEqual([sessions[0]])
    expect(getChatSearchSessions(sessions, null)).toBe(sessions)
  })

  test("defers provider search when chat search is disabled", async () => {
    let calls = 0
    const provider = {
      searchSessionsChat: async () => {
        calls++
        return [result]
      },
    } as unknown as DataProvider

    await expect(searchChatSessions(provider, deferredPolicy, sessions, "hello")).resolves.toEqual({ kind: "deferred", results: [] })
    expect(calls).toBe(0)
  })

  test("searches scoped sessions when chat search is enabled", async () => {
    const provider = {
      searchSessionsChat: async (records: SessionRecord[], query: string, options: { maxResults: number }) => {
        expect(records).toBe(sessions)
        expect(query).toBe("hello")
        expect(options).toEqual({ maxResults: 100 })
        return [result]
      },
    } as unknown as DataProvider

    await expect(searchChatSessions(provider, searchPolicy, sessions, "hello")).resolves.toEqual({ kind: "loaded", results: [result] })
  })
})
