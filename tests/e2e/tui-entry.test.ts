import { describe, expect, test } from "bun:test"
import { $ } from "bun"

const isWindows = process.platform === "win32"

describe("TUI entrypoint e2e", () => {
  test("root help documents TUI launch and storage flags", async () => {
    const result = await $`bun src/bin/opencode-session-tui.ts --help`.quiet()
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain("(no command)")
    expect(output).toContain("opencode-session-tui tui")
    expect(output).toContain("--experimental-sqlite")
    expect(output).toContain("--db <path>")
    expect(output).toContain("Hybrid")
  })

  test("tui help exits before interactive renderer launch", async () => {
    const result = await $`bun src/bin/opencode-session-tui.ts tui --help`.quiet()
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain("OpenCode Metadata TUI")
    expect(output).toContain("Storage options")
    expect(output).toContain("Default")
    expect(output).toContain("Hybrid")
    expect(output).toContain("Projects:")
    expect(output).toContain("enter            Open sessions")
    expect(output).toContain("Sessions:")
    expect(output).toContain("c                Clear filter")
    expect(output).toContain("Confirm:")
    expect(output).toContain("enter / y        Confirm")
    expect(output).toContain("escape / n       Cancel")
  })

  test("root TUI storage flags work without explicit tui subcommand", async () => {
    const result = await $`bun src/bin/opencode-session-tui.ts --db C:/temp/opencode.db --help`.quiet()
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain("OpenCode Metadata TUI")
    expect(output).toContain("Storage options")
  })

  test("package start script launches TUI entrypoint", async () => {
    const result = await $`bun run start -- --help`.quiet()
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain("(no command)")
    expect(output).toContain("TUI STORAGE OPTIONS")
  })

  test.skipIf(!isWindows)("windows batch launcher opens manager entrypoint", async () => {
    const result = await $`cmd /c launch-oc-session-tui.bat --help`.quiet()
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain("(no command)")
    expect(output).toContain("TUI STORAGE OPTIONS")
  })
})
