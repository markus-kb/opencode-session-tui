import { describe, expect, test } from "bun:test"
import {
  TERMINAL_CLEANUP_ANSI,
  createTerminalShutdown,
  writeTerminalCleanup,
} from "../../src/tui/terminal-shutdown"

describe("terminal shutdown", () => {
  test("writes terminal cleanup ANSI sequence", () => {
    const writes: string[] = []
    writeTerminalCleanup({ write: (chunk: string) => {
      writes.push(chunk)
      return true
    } })

    expect(writes).toEqual([TERMINAL_CLEANUP_ANSI])
  })

  test("destroys renderer once and is idempotent", () => {
    const calls: string[] = []
    const shutdown = createTerminalShutdown(
      { destroy: () => calls.push("destroy") },
      { write: () => {
        calls.push("cleanup")
        return true
      } },
    )

    shutdown()
    shutdown()

    expect(calls).toEqual(["destroy", "cleanup"])
  })

  test("still restores terminal when renderer destroy throws", () => {
    const calls: string[] = []
    const shutdown = createTerminalShutdown(
      { destroy: () => {
        calls.push("destroy")
        throw new Error("boom")
      } },
      { write: () => {
        calls.push("cleanup")
        return true
      } },
    )

    shutdown()

    expect(calls).toEqual(["destroy", "cleanup"])
  })
})
