/**
 * Tests for backend auto-detection logic.
 */

import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { detectStorageSources, resolveBackend } from "../../src/tui/backend-resolver"

describe("resolveBackend", () => {
  const tempRoots: string[] = []

  function tempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "oc-manager-backend-"))
    tempRoots.push(root)
    return root
  }

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("returns explicit 'sqlite' when backend is set", () => {
    expect(resolveBackend("sqlite")).toBe("sqlite")
  })

  test("returns explicit 'jsonl' when backend is set", () => {
    expect(resolveBackend("jsonl")).toBe("jsonl")
  })

  test("returns explicit 'hybrid' when backend is set", () => {
    expect(resolveBackend("hybrid")).toBe("hybrid")
  })

  test("returns 'sqlite' when dbPath is provided even without explicit backend", () => {
    expect(resolveBackend(undefined, "/some/path.db")).toBe("sqlite")
  })

  test("auto-detects 'sqlite' when only SQLite exists", () => {
    const root = tempRoot()
    const dbPath = join(root, "opencode.db")
    writeFileSync(dbPath, "")

    expect(resolveBackend(undefined, undefined, { defaultSqlitePath: dbPath, root })).toBe("sqlite")
  })

  test("auto-detects 'hybrid' when SQLite and legacy sessions exist", () => {
    const root = tempRoot()
    const dbPath = join(root, "opencode.db")
    writeFileSync(dbPath, "")
    mkdirSync(join(root, "storage", "session"), { recursive: true })

    expect(resolveBackend(undefined, undefined, { defaultSqlitePath: dbPath, root })).toBe("hybrid")
  })

  test("auto-detects 'jsonl' when SQLite does not exist", () => {
    const root = tempRoot()
    expect(resolveBackend(undefined, undefined, { defaultSqlitePath: join(root, "missing.db"), root })).toBe("jsonl")
  })

  test("detects SQLite and legacy JSON availability", () => {
    const root = tempRoot()
    const dbPath = join(root, "opencode.db")
    writeFileSync(dbPath, "")
    mkdirSync(join(root, "storage", "session"), { recursive: true })

    expect(detectStorageSources({ defaultSqlitePath: dbPath, root })).toEqual({
      sqliteAvailable: true,
      legacyJsonAvailable: true,
    })
  })
})
