import { describe, it, expect } from "bun:test"
import { sortProjectRecords } from "../../src/tui/projects-panel-sort"
import type { ProjectRecord } from "../../src/lib/opencode-data"

function makeRecord(id: string, created: number, updated: number): ProjectRecord {
  return {
    index: 0,
    bucket: "project",
    filePath: "",
    projectId: id,
    worktree: "",
    vcs: null,
    state: "unknown",
    createdAt: new Date(created),
    updatedAt: new Date(updated),
  }
}

const a = makeRecord("alpha", 1000, 3000)
const b = makeRecord("beta", 2000, 1000)
const c = makeRecord("gamma", 3000, 2000)
const base = [a, b, c]

describe("sortProjectRecords", () => {
  it("created mode: newest createdAt first", () => {
    const sorted = sortProjectRecords(base, "created")
    expect(sorted.map((r) => r.projectId)).toEqual(["gamma", "beta", "alpha"])
  })

  it("alpha mode: alphabetical by projectId", () => {
    const sorted = sortProjectRecords(base, "alpha")
    expect(sorted.map((r) => r.projectId)).toEqual(["alpha", "beta", "gamma"])
  })

  it("updated mode: newest updatedAt first", () => {
    const sorted = sortProjectRecords(base, "updated")
    expect(sorted.map((r) => r.projectId)).toEqual(["alpha", "gamma", "beta"])
  })

  it("updated mode differs from created mode when timestamps differ", () => {
    const byCreated = sortProjectRecords(base, "created").map((r) => r.projectId)
    const byUpdated = sortProjectRecords(base, "updated").map((r) => r.projectId)
    expect(byCreated).not.toEqual(byUpdated)
  })

  it("does not mutate the input array", () => {
    const input = [...base]
    sortProjectRecords(input, "alpha")
    expect(input[0]).toBe(a)
    expect(input[1]).toBe(b)
    expect(input[2]).toBe(c)
  })

  it("falls back to createdAt when updatedAt is null", () => {
    const x = { ...makeRecord("x", 5000, 0), updatedAt: null }
    const y = makeRecord("y", 1000, 9000)
    const sorted = sortProjectRecords([x, y], "updated")
    // x.updatedAt is null → falls back to createdAt 5000; y.updatedAt is 9000 → y wins
    expect(sorted[0].projectId).toBe("y")
    expect(sorted[1].projectId).toBe("x")
  })
})
