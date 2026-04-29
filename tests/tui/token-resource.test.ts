import { describe, expect, test } from "bun:test"
import type { DataProvider } from "../../src/lib/opencode-data-provider"
import type { AggregateTokenSummary, SessionRecord, TokenSummary } from "../../src/lib/opencode-data"
import { createInitialTuiState, openWorkspace } from "../../src/tui/app-state"
import { getResourcePolicy } from "../../src/tui/resource-policy"
import { computeProjectTokens, computeSessionTokens, computeFilteredProjectTokens } from "../../src/tui/token-resource"

const knownSummary: AggregateTokenSummary = {
  total: { kind: "known", tokens: { input: 100, output: 50, reasoning: 10, cacheRead: 0, cacheWrite: 0, total: 160 } },
}

const knownToken: TokenSummary = { kind: "known", tokens: { input: 80, output: 30, reasoning: 5, cacheRead: 0, cacheWrite: 0, total: 115 } }

function createSession(id: string, projectId: string): SessionRecord {
  return {
    index: 0,
    sessionId: id,
    projectId,
    directory: "/tmp/" + projectId,
    title: "Test session",
    version: "test",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    filePath: "fixture:" + id,
  }
}

function createProvider(): DataProvider & { calls: { projectTokens: number; sessionTokens: number } } {
  const calls = { projectTokens: 0, sessionTokens: 0 }
  return {
    backend: "jsonl",
    calls,
    async loadProjectRecords() { return [] },
    async loadSessionRecords() { return [] },
    async loadSessionChatIndex() { return [] },
    async loadMessageParts() { return [] },
    async hydrateChatMessageParts(message) { return message },
    async deleteProjectMetadata() { return { removed: [], failed: [] } },
    async deleteSessionMetadata() { return { removed: [], failed: [] } },
    async updateSessionTitle() {},
    async moveSession(session) { return session },
    async copySession(session) { return session },
    async computeSessionTokenSummary() {
      calls.sessionTokens += 1
      return knownToken
    },
    async computeProjectTokenSummary() {
      calls.projectTokens += 1
      return knownSummary
    },
    async computeGlobalTokenSummary() {
      return {
        total: { kind: "known", tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        unknownSessions: 0,
      }
    },
    async searchSessionsChat() { return [] },
  }
}

describe("TUI token resource", () => {
  test("computeProjectTokens skips when token policy defers", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(createInitialTuiState())

    const result = await computeProjectTokens(provider, policy, "project-a", [createSession("s1", "project-a")])

    expect(result).toBeNull()
    expect(provider.calls.projectTokens).toBe(0)
  })

  test("computeProjectTokens delegates to provider when token policy enables", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "projects"))

    const result = await computeProjectTokens(provider, policy, "project-a", [createSession("s1", "project-a")])

    expect(result).toEqual(knownSummary)
    expect(provider.calls.projectTokens).toBe(1)
  })

  test("computeProjectTokens returns null when sessions are empty", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "projects"))

    const result = await computeProjectTokens(provider, policy, "project-a", [])

    expect(result).toBeNull()
    expect(provider.calls.projectTokens).toBe(0)
  })

  test("computeSessionTokens skips when token policy defers", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(createInitialTuiState())

    const result = await computeSessionTokens(provider, policy, createSession("s1", "project-a"))

    expect(result).toBeNull()
    expect(provider.calls.sessionTokens).toBe(0)
  })

  test("computeSessionTokens delegates to provider when token policy enables", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))

    const result = await computeSessionTokens(provider, policy, createSession("s1", "project-a"))

    expect(result).toEqual(knownToken)
    expect(provider.calls.sessionTokens).toBe(1)
  })

  test("computeSessionTokens returns null when session is null", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))

    const result = await computeSessionTokens(provider, policy, null)

    expect(result).toBeNull()
    expect(provider.calls.sessionTokens).toBe(0)
  })

  test("computeFilteredProjectTokens skips when no project filter is active", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))

    const result = await computeFilteredProjectTokens(provider, policy, null, [createSession("s1", "project-a")])

    expect(result).toBeNull()
    expect(provider.calls.projectTokens).toBe(0)
  })

  test("computeFilteredProjectTokens delegates to provider when project filter is active", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))
    const sessions = [createSession("s1", "project-a"), createSession("s2", "project-a")]

    const result = await computeFilteredProjectTokens(provider, policy, "project-a", sessions)

    expect(result).toEqual(knownSummary)
    expect(provider.calls.projectTokens).toBe(1)
  })

  test("computeFilteredProjectTokens returns null when token policy defers", async () => {
    const provider = createProvider()
    const policy = getResourcePolicy(createInitialTuiState())

    const result = await computeFilteredProjectTokens(provider, policy, "project-a", [createSession("s1", "project-a")])

    expect(result).toBeNull()
    expect(provider.calls.projectTokens).toBe(0)
  })

  test("integration: home policy blocks all token computations without provider calls", async () => {
    const provider = createProvider()
    const homePolicy = getResourcePolicy(createInitialTuiState())
    const sessions = [createSession("s1", "project-a")]

    const r1 = await computeProjectTokens(provider, homePolicy, "project-a", sessions)
    const r2 = await computeSessionTokens(provider, homePolicy, sessions[0])
    const r3 = await computeFilteredProjectTokens(provider, homePolicy, "project-a", sessions)

    expect(r1).toBeNull()
    expect(r2).toBeNull()
    expect(r3).toBeNull()
    expect(provider.calls.projectTokens).toBe(0)
    expect(provider.calls.sessionTokens).toBe(0)
  })

  test("integration: workspace policy enables all token computations with single provider call each", async () => {
    const provider = createProvider()
    const wsPolicy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))
    const sessions = [createSession("s1", "project-a")]

    const r1 = await computeProjectTokens(provider, wsPolicy, "project-a", sessions)
    const r2 = await computeSessionTokens(provider, wsPolicy, sessions[0])
    const r3 = await computeFilteredProjectTokens(provider, wsPolicy, "project-a", sessions)

    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
    expect(r3).not.toBeNull()
    expect(provider.calls.projectTokens).toBe(2)
    expect(provider.calls.sessionTokens).toBe(1)
  })
})
