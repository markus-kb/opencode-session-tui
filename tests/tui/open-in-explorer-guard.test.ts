import { describe, it, expect } from "bun:test"
import { shouldOpenInExplorer } from "../../src/tui/open-in-explorer-guard"
import type { ProjectRecord } from "../../src/lib/opencode-data"

// ---------------------------------------------------------------------------
// shouldOpenInExplorer — guard deciding whether the O key triggers openPath
//
// Rules:
//   - Must have a non-empty worktree path.
//   - State must NOT be "missing" (directory no longer exists on disk).
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<ProjectRecord>): ProjectRecord {
  return {
    index: 1,
    bucket: "project",
    filePath: "/data/proj.json",
    projectId: "abc123",
    worktree: "/home/user/proj",
    vcs: "git",
    state: "present",
    createdAt: null,
    updatedAt: null,
    ...overrides,
  } as ProjectRecord
}

describe("shouldOpenInExplorer", () => {
  it("returns true for a present project with a worktree", () => {
    expect(shouldOpenInExplorer(makeRecord({ state: "present", worktree: "/home/user/proj" }))).toBe(true)
  })

  it("returns false for a missing project even when worktree is set", () => {
    // worktree string exists but directory is gone — O must be a no-op
    expect(shouldOpenInExplorer(makeRecord({ state: "missing", worktree: "/home/user/gone" }))).toBe(false)
  })

  it("returns false when worktree is empty string", () => {
    expect(shouldOpenInExplorer(makeRecord({ state: "present", worktree: "" }))).toBe(false)
  })

  it("returns false for unknown state with empty worktree", () => {
    expect(shouldOpenInExplorer(makeRecord({ state: "unknown", worktree: "" }))).toBe(false)
  })

  it("returns true for unknown state with a valid worktree", () => {
    // unknown means we couldn't determine state — still try to open
    expect(shouldOpenInExplorer(makeRecord({ state: "unknown", worktree: "/home/user/proj" }))).toBe(true)
  })

  it("returns false when record is null/undefined", () => {
    expect(shouldOpenInExplorer(null)).toBe(false)
    expect(shouldOpenInExplorer(undefined)).toBe(false)
  })
})
