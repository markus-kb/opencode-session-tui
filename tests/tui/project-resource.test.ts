import { describe, expect, test } from "bun:test"
import type { DataProvider } from "../../src/lib/opencode-data-provider"
import type { ProjectRecord, SessionRecord } from "../../src/lib/opencode-data"
import { createInitialTuiState, openWorkspace } from "../../src/tui/app-state"
import { getResourcePolicy } from "../../src/tui/resource-policy"
import { loadProjectIndex, filterSessionsByProject, reindexSessions } from "../../src/tui/project-resource"
import { loadSessionIndex } from "../../src/tui/session-resource"

function createProject(id: string): ProjectRecord {
  return {
    index: 1,
    bucket: "project",
    filePath: `fixture:${id}`,
    projectId: id,
    worktree: `/tmp/${id}`,
    vcs: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    state: "active",
  }
}

function createSession(id: string, projectId: string): SessionRecord {
  return {
    index: 1,
    sessionId: id,
    projectId,
    directory: `/tmp/${projectId}`,
    title: "Test session",
    version: "test",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    filePath: `fixture:${id}`,
  }
}

function createProvider(projects: ProjectRecord[], sessions: SessionRecord[]): DataProvider & { calls: { projects: number; sessions: number } } {
  const calls = { projects: 0, sessions: 0 }
  return {
    backend: "jsonl",
    calls,
    async loadProjectRecords() {
      calls.projects += 1
      return projects
    },
    async loadSessionRecords() {
      calls.sessions += 1
      return sessions
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
    async computeGlobalTokenSummary() {
      return {
        total: { kind: "known", tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        unknownSessions: 0,
      }
    },
    async searchSessionsChat() { return [] },
  }
}

describe("TUI project resource", () => {
  test("does not load projects while home resource policy defers metadata", async () => {
    const provider = createProvider([createProject("p1")], [])
    const result = await loadProjectIndex(provider, getResourcePolicy(createInitialTuiState()))

    expect(result).toEqual({ kind: "deferred", records: [] })
    expect(provider.calls.projects).toBe(0)
  })

  test("loads workspace project index once for shared consumers", async () => {
    const provider = createProvider([createProject("p1"), createProject("p2")], [])
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "projects"))
    const result = await loadProjectIndex(provider, policy)

    expect(result.kind).toBe("loaded")
    expect(result.records.map((p) => p.projectId)).toEqual(["p1", "p2"])
    expect(provider.calls.projects).toBe(1)
  })

  test("derives filtered sessions from root session index by project id", () => {
    const sessions = [
      createSession("s1", "project-a"),
      createSession("s2", "project-b"),
      createSession("s3", "project-a"),
    ]

    const filtered = filterSessionsByProject(sessions, "project-a")

    expect(filtered.map((s) => s.sessionId)).toEqual(["s1", "s3"])
  })

  test("returns all sessions when project filter is undefined", () => {
    const sessions = [
      createSession("s1", "project-a"),
      createSession("s2", "project-b"),
    ]

    const filtered = filterSessionsByProject(sessions, undefined)

    expect(filtered).toEqual(sessions)
  })

  test("returns empty array when no sessions match the project filter", () => {
    const sessions = [
      createSession("s1", "project-a"),
    ]

    const filtered = filterSessionsByProject(sessions, "project-z")

    expect(filtered).toEqual([])
  })

  test("reindexes filtered sessions with sequential indices", () => {
    const sessions = [
      { ...createSession("s1", "project-a"), index: 5 },
      { ...createSession("s2", "project-a"), index: 12 },
      { ...createSession("s3", "project-a"), index: 99 },
    ]

    const reindexed = reindexSessions(sessions)

    expect(reindexed.map((s) => s.index)).toEqual([0, 1, 2])
    expect(reindexed.map((s) => s.sessionId)).toEqual(["s1", "s2", "s3"])
  })

  test("reindexes empty array without error", () => {
    expect(reindexSessions([])).toEqual([])
  })

  test("panel derivation pipeline: root index → filter → reindex without extra provider calls", async () => {
    const sessions = [
      { ...createSession("s1", "project-a"), index: 0 },
      { ...createSession("s2", "project-b"), index: 1 },
      { ...createSession("s3", "project-a"), index: 2 },
      { ...createSession("s4", "project-c"), index: 3 },
    ]
    const provider = createProvider([], sessions)
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))

    // Root loads session index once
    const index = await loadSessionIndex(provider, policy)
    expect(provider.calls.sessions).toBe(1)

    // Panel derives records from root index without calling provider again
    const panelRecords = reindexSessions(filterSessionsByProject(index.records, "project-a"))
    expect(provider.calls.sessions).toBe(1)
    expect(panelRecords.map((s) => s.sessionId)).toEqual(["s1", "s3"])
    expect(panelRecords.map((s) => s.index)).toEqual([0, 1])
  })

  test("panel derivation pipeline: no filter returns all sessions reindexed", async () => {
    const sessions = [
      { ...createSession("s1", "project-a"), index: 5 },
      { ...createSession("s2", "project-b"), index: 10 },
    ]
    const provider = createProvider([], sessions)
    const policy = getResourcePolicy(openWorkspace(createInitialTuiState(), "sessions"))

    const index = await loadSessionIndex(provider, policy)
    const panelRecords = reindexSessions(filterSessionsByProject(index.records, undefined))
    expect(provider.calls.sessions).toBe(1)
    expect(panelRecords.map((s) => s.sessionId)).toEqual(["s1", "s2"])
    expect(panelRecords.map((s) => s.index)).toEqual([0, 1])
  })

  test("panel derivation pipeline: home policy defers root index, panel records stay empty", async () => {
    const sessions = [createSession("s1", "project-a")]
    const provider = createProvider([], sessions)

    const index = await loadSessionIndex(provider, getResourcePolicy(createInitialTuiState()))
    expect(index.kind).toBe("deferred")
    expect(provider.calls.sessions).toBe(0)

    const panelRecords = reindexSessions(filterSessionsByProject(index.records, "project-a"))
    expect(panelRecords).toEqual([])
  })
})
