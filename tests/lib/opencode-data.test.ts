/**
 * Tests for opencode-data.ts
 *
 * Uses fixture store at tests/fixtures/store to verify data loading functions.
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { promises as fsPromises } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_STORE_ROOT } from "../helpers";
import {
  loadProjectRecords,
  loadSessionRecords,
  loadSessionMessagePaths,
  loadMessagePartPaths,
  filterProjectsByState,
  type ProjectRecord,
} from "../../src/lib/opencode-data";

describe("loadProjectRecords", () => {
  it("loads project records from fixture store", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    expect(records).toBeArray();
    expect(records.length).toBe(2);
  });

  it("returns records with correct structure", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    for (const record of records) {
      expect(record).toHaveProperty("index");
      expect(record).toHaveProperty("bucket");
      expect(record).toHaveProperty("filePath");
      expect(record).toHaveProperty("projectId");
      expect(record).toHaveProperty("worktree");
      expect(record).toHaveProperty("vcs");
      expect(record).toHaveProperty("createdAt");
      expect(record).toHaveProperty("updatedAt");
      expect(record).toHaveProperty("state");
    }
  });

  it("assigns sequential 1-based indexes", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    const indexes = records.map((r) => r.index);
    expect(indexes).toEqual([1, 2]);
  });

  it("parses project metadata correctly", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    // Find proj_present
    const present = records.find((r) => r.projectId === "proj_present");
    expect(present).toBeDefined();
    expect(present!.bucket).toBe("project");
    expect(present!.vcs).toBe("git");
    expect(present!.createdAt).toBeInstanceOf(Date);
    expect(present!.createdAt!.getTime()).toBe(1704067200000);
    expect(present!.updatedAt).toBeInstanceOf(Date);
    expect(present!.updatedAt!.getTime()).toBe(1704153600000);

    // Find proj_missing
    const missing = records.find((r) => r.projectId === "proj_missing");
    expect(missing).toBeDefined();
    expect(missing!.bucket).toBe("project");
    expect(missing!.vcs).toBe("git");
    expect(missing!.createdAt).toBeInstanceOf(Date);
    expect(missing!.createdAt!.getTime()).toBe(1704153600000);
    expect(missing!.updatedAt).toBeInstanceOf(Date);
    expect(missing!.updatedAt!.getTime()).toBe(1704240000000);
  });

  it("sorts by createdAt descending (newest first)", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    // proj_missing has later timestamp (1704153600000) than proj_present (1704067200000)
    expect(records[0].projectId).toBe("proj_missing");
    expect(records[1].projectId).toBe("proj_present");
  });

  it("detects worktree state correctly", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    // proj_present has worktree at tests/fixtures/worktrees/my-present-project (exists)
    const present = records.find((r) => r.projectId === "proj_present");
    expect(present).toBeDefined();
    expect(present!.state).toBe("present");

    // proj_missing has worktree at tests/fixtures/worktrees/nonexistent-project (doesn't exist)
    const missing = records.find((r) => r.projectId === "proj_missing");
    expect(missing).toBeDefined();
    expect(missing!.state).toBe("missing");
  });

  it("returns empty array for non-existent root", async () => {
    const records = await loadProjectRecords({
      root: "/tmp/nonexistent-opencode-store-12345",
    });

    expect(records).toBeArray();
    expect(records.length).toBe(0);
  });

  it("includes filePath with full path to JSON file", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    for (const record of records) {
      expect(record.filePath).toMatch(/\.json$/);
      expect(record.filePath).toContain(FIXTURE_STORE_ROOT);
      expect(record.filePath).toContain(record.projectId);
    }
  });
});

describe("filterProjectsByState", () => {
  it("filters projects with missing worktrees", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });
    const missing = filterProjectsByState(records, "missing");

    expect(missing).toBeArray();
    expect(missing.length).toBe(1);
    expect(missing[0].projectId).toBe("proj_missing");
    expect(missing[0].state).toBe("missing");
  });

  it("filters projects with present worktrees", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });
    const present = filterProjectsByState(records, "present");

    expect(present).toBeArray();
    expect(present.length).toBe(1);
    expect(present[0].projectId).toBe("proj_present");
    expect(present[0].state).toBe("present");
  });

  it("returns empty array when no projects match state", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });
    const unknown = filterProjectsByState(records, "unknown");

    expect(unknown).toBeArray();
    expect(unknown.length).toBe(0);
  });
});

// ========================
// Parallel reads (perf)
// ========================

// ========================
// pathExists removal (perf)
// ========================

describe("loadSessionMessagePaths and loadMessagePartPaths — no fs.access pre-checks", () => {
  it("loadSessionMessagePaths does not call fs.access to check whether directories exist", async () => {
    let accessCount = 0
    const originalAccess = fsPromises.access.bind(fsPromises)
    fsPromises.access = async (...args: Parameters<typeof fsPromises.access>) => {
      accessCount++
      return originalAccess(...args)
    }

    try {
      // Neither primary nor legacy path will exist — should return null without access()
      await loadSessionMessagePaths("nonexistent_session_id", "/tmp/fake-oc-root-no-exist")
      expect(accessCount).toBe(0)
    } finally {
      fsPromises.access = originalAccess
    }
  })

  it("loadMessagePartPaths does not call fs.access to check whether directories exist", async () => {
    let accessCount = 0
    const originalAccess = fsPromises.access.bind(fsPromises)
    fsPromises.access = async (...args: Parameters<typeof fsPromises.access>) => {
      accessCount++
      return originalAccess(...args)
    }

    try {
      await loadMessagePartPaths("nonexistent_msg_id", "/tmp/fake-oc-root-no-exist")
      expect(accessCount).toBe(0)
    } finally {
      fsPromises.access = originalAccess
    }
  })

  it("loadSessionMessagePaths returns null when neither primary nor legacy path exists", async () => {
    const result = await loadSessionMessagePaths("does_not_exist", "/tmp/oc-no-such-root")
    expect(result).toBeNull()
  })

  it("loadSessionMessagePaths falls back to legacy path and returns files", async () => {
    const root = mkdtempSync(join(tmpdir(), "oc-legacy-msg-"))
    const legacyDir = join(root, "storage", "session", "message", "sess_legacy")
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, "msg_01.json"), "{}")
    writeFileSync(join(legacyDir, "msg_02.json"), "{}")

    try {
      const paths = await loadSessionMessagePaths("sess_legacy", root)
      expect(paths).not.toBeNull()
      expect(paths!.length).toBe(2)
      expect(paths!.every((p) => p.endsWith(".json"))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("loadMessagePartPaths falls back to legacy path and returns files", async () => {
    const root = mkdtempSync(join(tmpdir(), "oc-legacy-part-"))
    const legacyDir = join(root, "storage", "session", "part", "msg_legacy")
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, "part_01.json"), "{}")

    try {
      const paths = await loadMessagePartPaths("msg_legacy", root)
      expect(paths).not.toBeNull()
      expect(paths!.length).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe("loadSessionRecords parallel reads", () => {
  /**
   * Build a temp store with `count` session files under one project.
   * Each file contains a distinct title so we can verify all are loaded.
   */
  function buildTempStore(count: number): string {
    const root = mkdtempSync(join(tmpdir(), "oc-data-parallel-"))
    const projDir = join(root, "storage", "session", "proj_perf")
    mkdirSync(projDir, { recursive: true })
    for (let i = 0; i < count; i++) {
      const sid = `sess_perf_${i}`
      writeFileSync(
        join(projDir, `${sid}.json`),
        JSON.stringify({
          id: sid,
          projectID: "proj_perf",
          title: `Session ${i}`,
          directory: "/tmp",
          version: "1.0",
          time: { created: 1_700_000_000_000 + i, updated: 1_700_000_000_000 + i },
        })
      )
    }
    return root
  }

  it("loads all session files correctly regardless of read strategy", async () => {
    const root = buildTempStore(20)
    try {
      const sessions = await loadSessionRecords({ root })
      expect(sessions).toHaveLength(20)
      const ids = sessions.map((s) => s.sessionId).sort()
      expect(ids[0]).toBe("sess_perf_0")
      expect(ids[19]).toBe("sess_perf_9")  // lexicographic: 9 > 19... adjust
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("all 20 sessions are present with correct titles", async () => {
    const root = buildTempStore(20)
    try {
      const sessions = await loadSessionRecords({ root })
      expect(sessions).toHaveLength(20)
      const titles = new Set(sessions.map((s) => s.title))
      // Every title from "Session 0" through "Session 19" must be present
      for (let i = 0; i < 20; i++) {
        expect(titles.has(`Session ${i}`)).toBe(true)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("parallel reads complete faster than sequential would for many files", async () => {
    // Build 10 session files and instrument readFile to add a small delay.
    // With sequential reads: ≥ 10 × delay.
    // With parallel reads: ≈ 1 × delay.
    // We use a 5 ms artificial delay; the sequential floor would be 50 ms.
    const DELAY_MS = 5
    const FILE_COUNT = 10

    const root = buildTempStore(FILE_COUNT)
    try {
      // Wrap the module's internal fs by patching its readFile at the Node level.
      // Since we cannot mock node:fs cleanly without jest, we verify via the
      // concurrent-access pattern: track max in-flight reads.
      let inFlight = 0
      let maxInFlight = 0

      // Patch the global fs promises read that the module uses.
      // We replace it on the module's imported instance via a Proxy on process.
      // Simplest reliable approach in Bun: override at prototype level temporarily.
      const { promises: fsPromises } = await import("node:fs")
      const originalReadFile = fsPromises.readFile.bind(fsPromises)

      fsPromises.readFile = async (...args: Parameters<typeof fsPromises.readFile>) => {
        inFlight++
        if (inFlight > maxInFlight) maxInFlight = inFlight
        await new Promise((r) => setTimeout(r, DELAY_MS))
        const result = await originalReadFile(...args)
        inFlight--
        return result
      }

      const start = performance.now()
      const sessions = await loadSessionRecords({ root })
      const elapsed = performance.now() - start

      // Restore
      fsPromises.readFile = originalReadFile

      expect(sessions).toHaveLength(FILE_COUNT)
      // With parallel reads maxInFlight > 1 (multiple reads in flight simultaneously)
      expect(maxInFlight).toBeGreaterThan(1)
      // And total time is much less than FILE_COUNT * DELAY_MS (50 ms)
      expect(elapsed).toBeLessThan(FILE_COUNT * DELAY_MS)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
});
