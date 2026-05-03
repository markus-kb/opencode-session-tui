import { describe, it, expect, mock, beforeEach } from "bun:test"
import { resolveOpenCommand } from "../../src/lib/open-path"

describe("resolveOpenCommand", () => {
  it("returns 'open' for darwin", () => {
    expect(resolveOpenCommand("darwin")).toBe("open")
  })

  it("returns 'explorer.exe' for win32", () => {
    expect(resolveOpenCommand("win32")).toBe("explorer.exe")
  })

  it("returns 'xdg-open' for linux", () => {
    expect(resolveOpenCommand("linux")).toBe("xdg-open")
  })

  it("returns 'xdg-open' for unknown platform", () => {
    expect(resolveOpenCommand("freebsd")).toBe("xdg-open")
  })
})

// ---------------------------------------------------------------------------
// openPath — spawn-based fire-and-forget behaviour
//
// Why spawn+detached+unref instead of execFile:
//   explorer.exe on Windows delegates to an existing process and exits with
//   code 1 even when it successfully opened a window. execFile treats any
//   non-zero exit as an error, causing a false "Failed to open" notification
//   and sometimes double-spawning because two code paths race to open the
//   window. spawn with detached+unref lets the OS handle the child lifecycle
//   without us observing the exit code.
// ---------------------------------------------------------------------------
describe("openPath", () => {
  // We test the module by providing a fake spawn factory so we never touch
  // the real filesystem or launch real OS processes in CI.
  //
  // The contract under test:
  //   1. Resolves immediately after the child emits "spawn" (success path).
  //   2. Rejects only when the child emits "error" (e.g. binary not found).
  //   3. Never rejects due to a non-zero exit code (exit code is not observed).
  //   4. Calls spawn exactly once per openPath invocation.
  //   5. Passes detached:true and stdio:'ignore' so the process is fully
  //      decoupled from the Node/Bun parent.
  //   6. Calls unref() on the child so the parent event-loop does not wait.

  it("resolves when the child process emits spawn", async () => {
    const { openPathWith } = await import("../../src/lib/open-path")

    const child = makeFakeChild()
    const spawnFn = mock(() => child)

    const promise = openPathWith("/some/dir", "explorer.exe", spawnFn)
    child.emit("spawn")
    await expect(promise).resolves.toBeUndefined()
  })

  it("rejects when the child process emits error", async () => {
    const { openPathWith } = await import("../../src/lib/open-path")

    const child = makeFakeChild()
    const spawnFn = mock(() => child)
    const err = new Error("ENOENT: binary not found")

    const promise = openPathWith("/some/dir", "explorer.exe", spawnFn)
    child.emit("error", err)
    await expect(promise).rejects.toThrow("ENOENT")
  })

  it("does NOT reject when child exits with non-zero code", async () => {
    const { openPathWith } = await import("../../src/lib/open-path")

    const child = makeFakeChild()
    const spawnFn = mock(() => child)

    const promise = openPathWith("/some/dir", "explorer.exe", spawnFn)
    // spawn first (resolves promise), then exit with code 1 — must not throw
    child.emit("spawn")
    child.emit("close", 1)
    await expect(promise).resolves.toBeUndefined()
  })

  it("calls spawn exactly once per invocation", async () => {
    const { openPathWith } = await import("../../src/lib/open-path")

    const child = makeFakeChild()
    const spawnFn = mock(() => child)

    const promise = openPathWith("/some/dir", "explorer.exe", spawnFn)
    child.emit("spawn")
    await promise
    expect(spawnFn).toHaveBeenCalledTimes(1)
  })

  it("passes detached:true and stdio:ignore to spawn", async () => {
    const { openPathWith } = await import("../../src/lib/open-path")

    const child = makeFakeChild()
    const spawnFn = mock(() => child)

    const promise = openPathWith("/my/path", "xdg-open", spawnFn)
    child.emit("spawn")
    await promise

    expect(spawnFn).toHaveBeenCalledWith("xdg-open", ["/my/path"], {
      detached: true,
      stdio: "ignore",
    })
  })

  it("calls unref() on the child process", async () => {
    const { openPathWith } = await import("../../src/lib/open-path")

    const child = makeFakeChild()
    const spawnFn = mock(() => child)

    const promise = openPathWith("/some/dir", "open", spawnFn)
    child.emit("spawn")
    await promise
    expect(child.unref).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Minimal fake EventEmitter-like child process for testing
// ---------------------------------------------------------------------------
function makeFakeChild() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  return {
    unref: mock(() => {}),
    on(event: string, cb: (...args: unknown[]) => void) {
      listeners[event] ??= []
      listeners[event].push(cb)
      return this
    },
    emit(event: string, ...args: unknown[]) {
      for (const cb of listeners[event] ?? []) cb(...args)
    },
  }
}
