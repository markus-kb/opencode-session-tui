/**
 * Backend auto-detection for the TUI.
 *
 * Decides between "sqlite" and "jsonl" when the user has not
 * explicitly chosen a backend via CLI flags.
 */

import { existsSync } from "node:fs"
import { join } from "node:path"
import { DEFAULT_ROOT } from "../lib/opencode-data"
import { DEFAULT_SQLITE_PATH } from "../lib/opencode-data-sqlite"
import type { StorageBackend } from "../lib/opencode-data-provider"

/**
 * Resolve the storage backend when the caller has not explicitly set it.
 *
 * Priority:
 * 1. Explicit `backend` argument ("sqlite" or "jsonl").
 * 2. Explicit `dbPath` argument (implies "sqlite").
 * 3. Auto-detect: if the default SQLite database file exists, use "sqlite";
 *    otherwise fall back to "jsonl".
 *
 * This centralises the auto-detection logic so that both the CLI argument
 * parser and the programmatic `launchTUI()` entrypoint behave consistently.
 */
export function resolveBackend(
  backend?: StorageBackend,
  dbPath?: string,
  paths: { defaultSqlitePath?: string; root?: string } = {},
): StorageBackend {
  if (backend) {
    return backend
  }
  if (dbPath) {
    return "sqlite"
  }
  const sqlitePath = paths.defaultSqlitePath ?? DEFAULT_SQLITE_PATH
  const root = paths.root ?? DEFAULT_ROOT
  const hasSqlite = existsSync(sqlitePath)
  const hasJsonSessions = existsSync(join(root, "storage", "session"))
  if (hasSqlite && hasJsonSessions) {
    return "hybrid"
  }
  return hasSqlite ? "sqlite" : "jsonl"
}
