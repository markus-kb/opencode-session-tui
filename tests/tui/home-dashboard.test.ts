import { describe, expect, test } from "bun:test"
import { getHomeDashboardModel } from "../../src/tui/home-dashboard"

describe("home dashboard model", () => {
  test("shows storage mode, deferred library state, and primary actions", () => {
    const model = getHomeDashboardModel({
      backend: "hybrid",
      root: "C:/opencode",
      dbPath: "C:/opencode/opencode.db",
      tokenLabel: "deferred",
      sqliteAvailable: true,
      legacyJsonAvailable: true,
    })

    expect(model.title).toBe("OpenCode Metadata Manager")
    expect(model.storage).toContainEqual({ label: "Mode", value: "Hybrid" })
    expect(model.storage).toContainEqual({ label: "SQLite", value: "available: C:/opencode/opencode.db" })
    expect(model.storage).toContainEqual({ label: "Legacy JSON", value: "available: C:/opencode" })
    expect(model.library).toContainEqual({ label: "Projects", value: "deferred until workspace opens" })
    expect(model.library).toContainEqual({ label: "Sessions", value: "deferred until workspace opens" })
    expect(model.library).toContainEqual({ label: "Tokens", value: "deferred" })
    expect(model.actions.map(a => a.key)).toEqual(["Enter", "1", "2", "?", "Q"])
  })

  test("uses JSONL path when legacy backend is active", () => {
    const model = getHomeDashboardModel({
      backend: "jsonl",
      root: "C:/legacy",
      dbPath: undefined,
      tokenLabel: "deferred",
      sqliteAvailable: false,
      legacyJsonAvailable: true,
    })

    expect(model.storage).toContainEqual({ label: "Mode", value: "JSONL" })
    expect(model.storage).toContainEqual({ label: "Legacy JSON", value: "available: C:/legacy" })
    expect(model.storage.some(item => item.label === "SQLite")).toBe(false)
  })
})
