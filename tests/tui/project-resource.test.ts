import { describe, expect, test } from "bun:test"
import type { DataProvider } from "../../src/lib/opencode-data-provider"
import type { ProjectRecord, SessionRecord } from "../../src/lib/opencode-data"
import { createInitialTuiState, openWorkspace } from "../../src/tui/app-state"
import { getResourcePolicy } from "../../src/tui/resource-policy"
import { loadProjectIndex, filterSessionsByProject } from "../../src/tui/project-resource"

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
})
