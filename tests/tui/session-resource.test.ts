import { describe, expect, test } from "bun:test"
import type { DataProvider } from "../../src/lib/opencode-data-provider"
import type { SessionRecord } from "../../src/lib/opencode-data"
import { createInitialTuiState, openWorkspace } from "../../src/tui/app-state"
import { getResourcePolicy } from "../../src/tui/resource-policy"
import { loadGlobalTokensFromSessionIndex, loadSessionIndex } from "../../src/tui/session-resource"

function createSession(id: string): SessionRecord {
  return {
    index: 1,
    sessionId: id,
    projectId: "project-a",
    directory: "/tmp/project-a",
    title: "Test session",
    version: "test",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    filePath: `fixture:${id}`,
  }
}

function createProvider(records: SessionRecord[]): DataProvider & { calls: { sessions: number; globalTokens: number } } {
  const calls = { sessions: 0, globalTokens: 0 }
  return {
    backend: "jsonl",
    calls,
    async loadProjectRecords() { return [] },
    async loadSessionRecords() {
      calls.sessions += 1
      return records
    },
    async loadSessionChatIndex() { return [] },
    async loadMessageParts() { return [] },
    async hydrateChatMessageParts(message) { return message },
    async deleteProjectMetadata() { return { removed: [], failed: [] } },
    async deleteSessionMetadata() { return { removed: [], failed: [] } },
    async updateSessionTitle() {},
    async moveSession(session) { return session },
    async copySession(session) { return session },
    async computeSessionTokenSummary() { return { kind: "unknown", reason: "no_messages" } },
    async computeProjectTokenSummary() { return { total: { kind: "unknown", reason: "no_messages" } } },
    async computeGlobalTokenSummary(sessions) {
      calls.globalTokens += 1
      return {
        total: { kind: "known", tokens: { input: sessions.length, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: sessions.length } },
        unknownSessions: 0,
      }
    },
    async searchSessionsChat() { return [] },
  }
}

describe("TUI session resource", () => {
  test("does not load sessions while home resource policy defers metadata", async () => {
    const provider = createProvider([createSession("s1")])
    const result = await loadSessionIndex(provider, getResourcePolicy(createInitialTuiState()))

    expect(result).toEqual({ kind: "deferred", records: [] })
    expect(provider.calls.sessions).toBe(0)
  })

  test("loads workspace session index once for shared consumers", async () => {
    const provider = createProvider([createSession("s1"), createSession("s2")])
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))
    const result = await loadSessionIndex(provider, policy)

    expect(result.kind).toBe("loaded")
    expect(result.records.map((session) => session.sessionId)).toEqual(["s1", "s2"])
    expect(provider.calls.sessions).toBe(1)
  })

  test("computes global tokens from an existing session index without reloading sessions", async () => {
    const provider = createProvider([createSession("s1")])
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "projects"))
    const index = await loadSessionIndex(provider, policy)
    const summary = await loadGlobalTokensFromSessionIndex(provider, policy, index.records)

    expect(summary?.total.kind).toBe("known")
    expect(provider.calls.sessions).toBe(1)
    expect(provider.calls.globalTokens).toBe(1)
  })

  test("skips token computation when policy defers tokens", async () => {
    const provider = createProvider([createSession("s1")])
    const summary = await loadGlobalTokensFromSessionIndex(provider, getResourcePolicy(createInitialTuiState()), [createSession("s1")])

    expect(summary).toBeNull()
    expect(provider.calls.globalTokens).toBe(0)
  })
})
