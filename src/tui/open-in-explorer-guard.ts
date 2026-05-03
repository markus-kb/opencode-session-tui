import type { ProjectRecord } from "../lib/opencode-data"

/**
 * Determines whether the "open in file explorer" action should fire for the
 * given project record.
 *
 * Rules:
 *   1. Record must be non-null/undefined.
 *   2. worktree must be a non-empty string (path exists in metadata).
 *   3. state must NOT be "missing" — a missing project's directory is gone
 *      from disk; attempting to open it would produce an OS error dialog.
 *      "unknown" state is allowed: we couldn't stat the dir but the user may
 *      still want to try (network mounts, permission issues, etc.).
 */
export function shouldOpenInExplorer(record: ProjectRecord | null | undefined): boolean {
  if (!record) return false
  if (!record.worktree) return false
  if (record.state === "missing") return false
  return true
}
