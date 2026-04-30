import { describe, expect, test } from "bun:test"
import { $ } from "bun"

describe("TUI entrypoint e2e", () => {
  test("root help documents TUI launch and storage flags", async () => {
    const result = await $`bun src/bin/opencode-manager.ts --help`.quiet()
    const output = result.stdout.toString()

    expect(result.exitCode).toBe(0)
    expect(output).toContain("opencode-manager tui")
    expect(output).toContain("--experimental-sqlite")
    expect(output).toContain("--db <path>")
    expect(output).toContain("Hybrid")
  })

  test("tui help exits before interactive renderer launch", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tui --help`.quiet()
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
  })
})
