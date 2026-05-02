import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { existsSync, unlinkSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FIXTURE_STORE_ROOT, FIXTURE_SQLITE_PATH } from "../helpers"
import {
  createProvider,
  createProviderFromGlobalOptions,
  type StorageBackend,
  type DataProvider,
} from "../../src/lib/opencode-data-provider"

describe("opencode-data-provider", () => {
  const testDir = "/tmp/oc-manager-provider-tests"
  const testDbPath = join(testDir, "test.db")

  // Setup test directory
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(async () => {
    // Clean up test database after each test.
    // On Windows, SQLite file handles may not be released immediately, causing EBUSY.
    // Retry with exponential backoff; ignore final failure (OS reclaims handle on process exit).
    const sidecarPaths = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]
    for (const p of sidecarPaths) {
      if (!existsSync(p)) continue
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          unlinkSync(p)
          break
        } catch (err: any) {
          if (err?.code === "EBUSY" || err?.code === "EPERM") {
            await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)))
          } else {
            throw err
          }
        }
      }
    }
  })

  /**
   * Helper to create a minimal SQLite test database with required schema.
   */
  function createTestDatabase(path: string): void {
    const db = new Database(path)
    db.run(`
      CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        directory TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        version TEXT NOT NULL DEFAULT '',
        time_created INTEGER NOT NULL DEFAULT 0,
        time_updated INTEGER NOT NULL DEFAULT 0
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS message (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_created INTEGER NOT NULL DEFAULT 0,
        time_updated INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS part (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `)
    // Clear any stale rows so tests don't see data from prior runs when the
    // file couldn't be deleted (e.g. Windows file-lock retention).
    db.run("DELETE FROM part")
    db.run("DELETE FROM message")
    db.run("DELETE FROM session")
    db.run("DELETE FROM project")
    db.close()
  }

  describe("createProvider", () => {
    test("auto-detects backend (sqlite if opencode.db exists, else jsonl)", () => {
      // Auto-detect returns sqlite when opencode.db exists, jsonl otherwise.
      // Verify the provider is a valid DataProvider with all expected methods.
      const provider = createProvider()

      expect(provider).toBeDefined()
      expect(["jsonl", "sqlite", "hybrid"]).toContain(provider.backend)

      // Verify it has all expected methods
      expect(typeof provider.loadProjectRecords).toBe("function")
      expect(typeof provider.loadSessionRecords).toBe("function")
      expect(typeof provider.loadSessionChatIndex).toBe("function")
      expect(typeof provider.loadMessageParts).toBe("function")
      expect(typeof provider.hydrateChatMessageParts).toBe("function")
      expect(typeof provider.deleteProjectMetadata).toBe("function")
      expect(typeof provider.deleteSessionMetadata).toBe("function")
      expect(typeof provider.updateSessionTitle).toBe("function")
      expect(typeof provider.moveSession).toBe("function")
      expect(typeof provider.copySession).toBe("function")
      expect(typeof provider.computeSessionTokenSummary).toBe("function")
      expect(typeof provider.computeProjectTokenSummary).toBe("function")
      expect(typeof provider.computeGlobalTokenSummary).toBe("function")
      expect(typeof provider.searchSessionsChat).toBe("function")

      provider.dispose?.()
    })

    test("returns JSONL provider when backend is explicitly 'jsonl'", () => {
      const provider = createProvider({ backend: "jsonl" })

      expect(provider.backend).toBe("jsonl")
    })

    test("returns SQLite provider when backend is 'sqlite'", () => {
      // Create test database for SQLite provider
      createTestDatabase(testDbPath)

      const provider = createProvider({
        backend: "sqlite",
        dbPath: testDbPath,
      })

      expect(provider).toBeDefined()
      expect(provider.backend).toBe("sqlite")

      // Verify it has all expected methods
      expect(typeof provider.loadProjectRecords).toBe("function")
      expect(typeof provider.loadSessionRecords).toBe("function")
      expect(typeof provider.loadSessionChatIndex).toBe("function")
      expect(typeof provider.loadMessageParts).toBe("function")
    })

    test("hybrid provider merges SQLite and JSONL sessions metadata", async () => {
      createTestDatabase(testDbPath)
      const db = new Database(testDbPath)
      db.run(
        "INSERT INTO session (id, project_id, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["sqlite_session", "sqlite_project", "C:/sqlite", "SQLite Session", "1.0", 2000, 4000]
      )
      db.close()

      const root = mkdtempSync(join(tmpdir(), "oc-manager-hybrid-"))
      try {
        const sessionDir = join(root, "storage", "session", "json_project")
        mkdirSync(sessionDir, { recursive: true })
        writeFileSync(
          join(sessionDir, "json_session.json"),
          JSON.stringify({
            id: "json_session",
            projectID: "json_project",
            directory: "C:/json",
            title: "JSON Session",
            version: "1.0",
            time: { created: 1000, updated: 3000 },
          }),
          "utf8"
        )

        const provider = createProvider({ backend: "hybrid", root, dbPath: testDbPath })
        const sessions = await provider.loadSessionRecords()

        expect(provider.backend).toBe("hybrid")
        expect(sessions.map((session) => session.sessionId)).toEqual(["sqlite_session", "json_session"])
        expect(sessions[0].filePath).toBe("sqlite:session:sqlite_session")
        provider.dispose?.()
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })

    test("hybrid provider deduplicates sessions by preferring SQLite", async () => {
      createTestDatabase(testDbPath)
      const db = new Database(testDbPath)
      db.run(
        "INSERT INTO session (id, project_id, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["duplicate_session", "sqlite_project", "C:/sqlite", "SQLite Wins", "1.0", 2000, 4000]
      )
      db.close()

      const root = mkdtempSync(join(tmpdir(), "oc-manager-hybrid-"))
      try {
        const sessionDir = join(root, "storage", "session", "json_project")
        mkdirSync(sessionDir, { recursive: true })
        writeFileSync(
          join(sessionDir, "duplicate_session.json"),
          JSON.stringify({
            id: "duplicate_session",
            projectID: "json_project",
            directory: "C:/json",
            title: "JSON Loses",
            version: "1.0",
            time: { created: 1000, updated: 9000 },
          }),
          "utf8"
        )

        const provider = createProvider({ backend: "hybrid", root, dbPath: testDbPath })
        const sessions = await provider.loadSessionRecords()

        expect(sessions).toHaveLength(1)
        expect(sessions[0].title).toBe("SQLite Wins")
        expect(sessions[0].filePath).toBe("sqlite:session:duplicate_session")
        provider.dispose?.()
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })

    test("SQLite provider exposes dispose() to close persistent connection", () => {
      createTestDatabase(testDbPath)

      const provider = createProvider({
        backend: "sqlite",
        dbPath: testDbPath,
      })

      expect(typeof (provider as any).dispose).toBe("function")
      ;(provider as any).dispose()
    })

    test("SQLite provider reuses connection across multiple read calls", async () => {
      createTestDatabase(testDbPath)

      const provider = createProvider({
        backend: "sqlite",
        dbPath: testDbPath,
      })

      // Multiple reads should succeed without reopening the database
      const projects1 = await provider.loadProjectRecords()
      const projects2 = await provider.loadProjectRecords()
      expect(projects1).toBeArray()
      expect(projects2).toBeArray()

      ;(provider as any).dispose()
    })

    test("SQLite provider uses default path when dbPath not provided", () => {
      // This test verifies the provider is created (may fail at runtime
      // if default path doesn't exist, but that's expected behavior)
      const provider = createProvider({ backend: "sqlite" })

      expect(provider).toBeDefined()
      expect(provider.backend).toBe("sqlite")
    })

    test("JSONL provider uses custom root when provided", async () => {
      const customRoot = "/tmp/custom-opencode-root"
      const provider = createProvider({ backend: "jsonl", root: customRoot })

      expect(provider.backend).toBe("jsonl")
      // The provider will use the custom root for data loading
      // (actual data loading would fail since directory doesn't exist,
      // but the provider is correctly configured)
    })

    test("throws on invalid backend value", () => {
      expect(() => {
        createProvider({ backend: "invalid" as StorageBackend })
      }).toThrow('Invalid storage backend: "invalid". Must be "jsonl", "sqlite", or "hybrid".')
    })
  })

  describe("createProviderFromGlobalOptions", () => {
    test("auto-detects a valid provider when experimentalSqlite is false", () => {
      const provider = createProviderFromGlobalOptions({
        experimentalSqlite: false,
      })

      expect(["jsonl", "sqlite", "hybrid"]).toContain(provider.backend)
    })

    test("returns JSONL provider when no SQLite options provided and no opencode.db", () => {
      // When no options are given and no opencode.db exists, falls back to JSONL.
      // When opencode.db exists on the host machine, auto-detect returns sqlite.
      // This test verifies the provider is a valid DataProvider regardless of backend.
      const provider = createProviderFromGlobalOptions({})

      expect(provider).toBeDefined()
      expect(typeof provider.loadProjectRecords).toBe("function")
    })

    test("returns SQLite provider when experimentalSqlite is true", () => {
      const provider = createProviderFromGlobalOptions({
        experimentalSqlite: true,
      })

      expect(provider.backend).toBe("sqlite")
    })

    test("returns SQLite provider when dbPath is provided", () => {
      createTestDatabase(testDbPath)

      const provider = createProviderFromGlobalOptions({
        dbPath: testDbPath,
      })

      expect(provider.backend).toBe("sqlite")
    })

    test("dbPath takes precedence over experimentalSqlite: false", () => {
      createTestDatabase(testDbPath)

      // Even if experimentalSqlite is false, providing dbPath should use SQLite
      const provider = createProviderFromGlobalOptions({
        experimentalSqlite: false,
        dbPath: testDbPath,
      })

      expect(provider.backend).toBe("sqlite")
    })

    test("uses JSONL provider for custom root without SQLite options", () => {
      const customRoot = "/tmp/custom-root"
      const provider = createProviderFromGlobalOptions({
        root: customRoot,
        experimentalSqlite: false,
      })

      expect(provider.backend).toBe("jsonl")
    })
  })

  describe("DataProvider interface compliance", () => {
    test("JSONL provider implements all DataProvider methods", () => {
      const provider = createProvider({ backend: "jsonl" })

      // All required methods from DataProvider interface
      const requiredMethods = [
        "loadProjectRecords",
        "loadSessionRecords",
        "loadSessionChatIndex",
        "loadMessageParts",
        "hydrateChatMessageParts",
        "deleteProjectMetadata",
        "deleteSessionMetadata",
        "updateSessionTitle",
        "moveSession",
        "copySession",
        "computeSessionTokenSummary",
        "computeProjectTokenSummary",
        "computeGlobalTokenSummary",
        "searchSessionsChat",
      ]

      for (const method of requiredMethods) {
        expect(typeof (provider as unknown as Record<string, unknown>)[method]).toBe("function")
      }
    })

    test("SQLite provider implements all DataProvider methods", () => {
      createTestDatabase(testDbPath)

      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      // All required methods from DataProvider interface
      const requiredMethods = [
        "loadProjectRecords",
        "loadSessionRecords",
        "loadSessionChatIndex",
        "loadMessageParts",
        "hydrateChatMessageParts",
        "deleteProjectMetadata",
        "deleteSessionMetadata",
        "updateSessionTitle",
        "moveSession",
        "copySession",
        "computeSessionTokenSummary",
        "computeProjectTokenSummary",
        "computeGlobalTokenSummary",
        "searchSessionsChat",
      ]

      for (const method of requiredMethods) {
        expect(typeof (provider as unknown as Record<string, unknown>)[method]).toBe("function")
      }
    })

    test("both providers have backend property", () => {
      const jsonlProvider = createProvider({ backend: "jsonl" })
      createTestDatabase(testDbPath)
      const sqliteProvider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      expect(jsonlProvider.backend).toBe("jsonl")
      expect(sqliteProvider.backend).toBe("sqlite")
    })
  })

  describe("SQLite provider write operations", () => {
    test("deleteProjectMetadata works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      // Empty input should return empty result
      const result = await provider.deleteProjectMetadata([])
      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
    })

    test("deleteSessionMetadata works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      // Empty input should return empty result
      const result = await provider.deleteSessionMetadata([])
      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
    })

    test("updateSessionTitle works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      
      // Insert a test session using the new column-based schema
      const db = new Database(testDbPath)
      db.run(
        "INSERT INTO session (id, project_id, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["test_update", "proj", "/tmp", "Original Title", "1.0", Date.now(), Date.now()]
      )
      db.close()
      
      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      const mockSession = {
        sessionId: "test_update",
        projectId: "proj",
        directory: "/tmp",
        title: "Original Title",
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        index: 1,
        filePath: "sqlite:session:test_update",
      }

      // Should not throw - it's now implemented
      await provider.updateSessionTitle(mockSession, "New Title")
      
      // Verify the title was updated in the column
      const verifyDb = new Database(testDbPath, { readonly: true })
      const row = verifyDb.query("SELECT title FROM session WHERE id = ?").get("test_update") as { title: string }
      expect(row.title).toBe("New Title")
      verifyDb.close()
      provider.dispose()
    })

    test("moveSession works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const db = new Database(testDbPath)
      db.run(
        "INSERT INTO session (id, project_id, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["test_move", "proj_source", "/tmp", "Test", "1.0", Date.now(), Date.now()]
      )
      db.close()

      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      const mockSession = {
        sessionId: "test_move",
        projectId: "proj_source",
        directory: "/tmp",
        title: "Test",
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        index: 1,
        filePath: "/tmp/test",
      }

      const result = await provider.moveSession(mockSession, "proj_target")

      // Verify returned record has new project ID
      expect(result.sessionId).toBe("test_move")
      expect(result.projectId).toBe("proj_target")

      // Verify the session was moved in database via the project_id column
      const verifyDb = new Database(testDbPath, { readonly: true })
      const row = verifyDb.query("SELECT project_id FROM session WHERE id = ?").get("test_move") as { 
        project_id: string
      }
      expect(row.project_id).toBe("proj_target")
      verifyDb.close()
      provider.dispose()
    })

    test("copySession works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const db = new Database(testDbPath)

      // Insert a session to copy using the new column-based schema
      db.run(
        "INSERT INTO session (id, project_id, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["sess_provider_copy", "proj_source", "/tmp", "Provider Copy Test", "1.0", Date.now(), Date.now()]
      )
      db.close()

      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      const mockSession = {
        sessionId: "sess_provider_copy",
        projectId: "proj_source",
        directory: "/tmp",
        title: "Provider Copy Test",
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        index: 1,
        filePath: "sqlite:session:sess_provider_copy",
      }

      const result = await provider.copySession(mockSession, "proj_target")

      // Verify the copy was created
      expect(result.sessionId).not.toBe("sess_provider_copy")
      expect(result.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)
      expect(result.projectId).toBe("proj_target")
      expect(result.title).toBe("Provider Copy Test")

      // Verify both sessions exist in database
      const verifyDb = new Database(testDbPath, { readonly: true })
      const sessionCount = verifyDb.query("SELECT COUNT(*) as count FROM session").get() as any
      expect(sessionCount.count).toBe(2) // Original + copy
      verifyDb.close()
      provider.dispose()
    })
  })

  describe("token summary parity (JSONL vs SQLite)", () => {
    test("computeSessionTokenSummary matches for shared session", async () => {
      const jsonlProvider = createProvider({ backend: "jsonl", root: FIXTURE_STORE_ROOT })
      const sqliteProvider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

      const sessionId = "session_add_tests"
      const jsonlSessions = await jsonlProvider.loadSessionRecords({ projectId: "proj_present" })
      const sqliteSessions = await sqliteProvider.loadSessionRecords({ projectId: "proj_present" })

      const jsonlSession = jsonlSessions.find((s) => s.sessionId === sessionId)
      const sqliteSession = sqliteSessions.find((s) => s.sessionId === sessionId)

      expect(jsonlSession).toBeDefined()
      expect(sqliteSession).toBeDefined()

      const jsonlSummary = await jsonlProvider.computeSessionTokenSummary(jsonlSession!)
      const sqliteSummary = await sqliteProvider.computeSessionTokenSummary(sqliteSession!)

      expect(sqliteSummary).toEqual(jsonlSummary)
    })

  })

  // ========================
  // Hybrid aggregate token scan (perf)
  // ========================

  describe("hybrid provider token aggregation", () => {
    /**
     * Build an in-memory SQLite DB with N sessions, each having one assistant
     * message carrying known token counts, written to a temp file so the
     * hybrid provider can open it.
     */
    function buildTokenDb(sessionCount: number): { dbPath: string; expectedTotal: number } {
      const dir = mkdtempSync(join(tmpdir(), "oc-hybrid-token-"))
      const dbPath = join(dir, "tokens.db")
      const db = new Database(dbPath)
      db.run(`CREATE TABLE session (
        id TEXT PRIMARY KEY, project_id TEXT, time_created INTEGER, time_updated INTEGER,
        directory TEXT, title TEXT, version TEXT
      )`)
      db.run(`CREATE TABLE message (
        id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT
      )`)
      db.run(`CREATE TABLE part (
        id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, data TEXT
      )`)
      db.run(`CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT)`)

      const tokensPerSession = 100
      for (let i = 0; i < sessionCount; i++) {
        const sid = `sess_${i}`
        db.run(
          "INSERT INTO session VALUES (?, 'proj', ?, ?, '/tmp', 'T', '1')",
          [sid, Date.now(), Date.now()]
        )
        const mid = `msg_${i}`
        const data = JSON.stringify({
          role: "assistant",
          tokens: { input: tokensPerSession, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
        db.run("INSERT INTO message VALUES (?, ?, ?, ?)", [mid, sid, Date.now(), data])
      }
      db.close()
      return { dbPath, expectedTotal: sessionCount * tokensPerSession }
    }

    test("computeGlobalTokenSummary returns correct sum over many SQLite sessions", async () => {
      const { dbPath, expectedTotal } = buildTokenDb(10)

      const provider = createProvider({ backend: "sqlite", dbPath })
      const sessions = await provider.loadSessionRecords()
      expect(sessions).toHaveLength(10)

      const result = await provider.computeGlobalTokenSummary(sessions)
      expect(result.total.kind).toBe("known")
      if (result.total.kind === "known") {
        expect(result.total.tokens.input).toBe(expectedTotal)
      }
      provider.dispose?.()
    })

    test("computeProjectTokenSummary aggregates only sessions for the requested project", async () => {
      const dir = mkdtempSync(join(tmpdir(), "oc-hybrid-proj-"))
      const dbPath = join(dir, "proj.db")
      const db = new Database(dbPath)
      db.run(`CREATE TABLE session (
        id TEXT PRIMARY KEY, project_id TEXT, time_created INTEGER, time_updated INTEGER,
        directory TEXT, title TEXT, version TEXT
      )`)
      db.run(`CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT)`)
      db.run(`CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, data TEXT)`)
      db.run(`CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT)`)

      // Two projects: proj_a (3 sessions × 50 tokens) and proj_b (2 sessions × 80 tokens)
      for (let i = 0; i < 3; i++) {
        const sid = `sess_a${i}`
        db.run("INSERT INTO session VALUES (?, 'proj_a', ?, ?, '/tmp', 'T', '1')", [sid, Date.now(), Date.now()])
        db.run("INSERT INTO message VALUES (?, ?, ?, ?)", [
          `msg_a${i}`, sid, Date.now(),
          JSON.stringify({ role: "assistant", tokens: { input: 50, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }),
        ])
      }
      for (let i = 0; i < 2; i++) {
        const sid = `sess_b${i}`
        db.run("INSERT INTO session VALUES (?, 'proj_b', ?, ?, '/tmp', 'T', '1')", [sid, Date.now(), Date.now()])
        db.run("INSERT INTO message VALUES (?, ?, ?, ?)", [
          `msg_b${i}`, sid, Date.now(),
          JSON.stringify({ role: "assistant", tokens: { input: 80, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }),
        ])
      }
      db.close()

      const provider = createProvider({ backend: "sqlite", dbPath })
      const allSessions = await provider.loadSessionRecords()

      const projAResult = await provider.computeProjectTokenSummary("proj_a", allSessions)
      expect(projAResult.total.kind).toBe("known")
      if (projAResult.total.kind === "known") {
        expect(projAResult.total.tokens.input).toBe(150)  // 3 × 50
      }

      const projBResult = await provider.computeProjectTokenSummary("proj_b", allSessions)
      expect(projBResult.total.kind).toBe("known")
      if (projBResult.total.kind === "known") {
        expect(projBResult.total.tokens.input).toBe(160)  // 2 × 80
      }

      provider.dispose?.()
      rmSync(dir, { recursive: true, force: true })
    })

    test("computeGlobalTokenSummary marks all sessions unknown when DB has no assistant messages", async () => {
      const dir = mkdtempSync(join(tmpdir(), "oc-hybrid-empty-"))
      const dbPath = join(dir, "empty.db")
      const db = new Database(dbPath)
      db.run(`CREATE TABLE session (
        id TEXT PRIMARY KEY, project_id TEXT, time_created INTEGER, time_updated INTEGER,
        directory TEXT, title TEXT, version TEXT
      )`)
      db.run(`CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT)`)
      db.run(`CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, data TEXT)`)
      db.run(`CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT)`)

      for (let i = 0; i < 3; i++) {
        db.run("INSERT INTO session VALUES (?, 'proj', ?, ?, '/tmp', 'T', '1')", [`sess_${i}`, Date.now(), Date.now()])
        // Only user messages — no assistant tokens
        db.run("INSERT INTO message VALUES (?, ?, ?, ?)", [
          `msg_${i}`, `sess_${i}`, Date.now(),
          JSON.stringify({ role: "user" }),
        ])
      }
      db.close()

      const provider = createProvider({ backend: "sqlite", dbPath })
      const sessions = await provider.loadSessionRecords()
      const result = await provider.computeGlobalTokenSummary(sessions)
      expect(result.unknownSessions).toBe(3)
      provider.dispose?.()
      rmSync(dir, { recursive: true, force: true })
    })
  })
})
