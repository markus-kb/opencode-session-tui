import { describe, expect, test } from "bun:test"
import type { SessionRecord } from "../../src/lib/opencode-data"
import { deriveVisibleSessions } from "../../src/tui/sessions-panel-derive"

const sessions: SessionRecord[] = [
  {
    index: 1,
    bucket: "b",
    directory: "/tmp/a",
    sessionId: "session-a",
    projectId: "project-a",
    title: "Alpha fixes",
    version: "v1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-03T00:00:00Z"),
  },
  {
    index: 2,
    bucket: "b",
    directory: "/tmp/b",
    sessionId: "session-b",
    projectId: "project-b",
    title: "Beta docs",
    version: "v1",
    createdAt: new Date("2024-01-02T00:00:00Z"),
    updatedAt: new Date("2024-01-02T00:00:00Z"),
  },
]

describe("sessions panel derive", () => {
  test("sorts by updated descending by default", () => {
    const visible = deriveVisibleSessions(sessions, "", "updated")

    expect(visible.map((s) => s.sessionId)).toEqual(["session-a", "session-b"])
  })

  test("supports created sort and fuzzy query", () => {
    const visible = deriveVisibleSessions(sessions, "beta", "created")

    expect(visible.map((s) => s.sessionId)).toEqual(["session-b"])
  })
})
