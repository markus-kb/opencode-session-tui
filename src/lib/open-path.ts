import { spawn, type SpawnOptions } from "node:child_process"
import type { ChildProcess } from "node:child_process"

export function resolveOpenCommand(platform: string): string {
  if (platform === "darwin") return "open"
  if (platform === "win32") return "explorer.exe"
  return "xdg-open"
}

// Minimal type for the spawn factory so tests can inject a fake without
// needing to satisfy the full ChildProcess interface.
type SpawnFn = (cmd: string, args: string[], opts: SpawnOptions) => Pick<ChildProcess, "on" | "unref">

/**
 * Open a directory path using the given command, via an injectable spawn
 * factory. Resolves on the "spawn" event (process launched successfully),
 * rejects only on the "error" event (binary not found, etc.).
 *
 * Why spawn+detached+unref instead of execFile:
 *   explorer.exe on Windows delegates to an existing process and exits with
 *   code 1 even on success. execFile treats any non-zero exit as an error,
 *   producing a false "Failed to open" notification. spawn with
 *   detached+unref lets the OS own the child lifecycle entirely — we never
 *   observe the exit code.
 */
export function openPathWith(dirPath: string, cmd: string, spawnFn: SpawnFn): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(cmd, [dirPath], { detached: true, stdio: "ignore" })
    child.unref()
    child.on("spawn", () => resolve())
    child.on("error", (err) => reject(err))
  })
}

export function openPath(dirPath: string): Promise<void> {
  const cmd = resolveOpenCommand(process.platform)
  return openPathWith(dirPath, cmd, spawn)
}
