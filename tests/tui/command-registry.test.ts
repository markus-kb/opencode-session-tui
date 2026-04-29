import { describe, expect, test } from "bun:test"
import {
  createCommandRegistry,
  type Command,
  type CommandScope,
} from "../../src/tui/command-registry"

function createCommand(id: string, scope: CommandScope, keys: string[]): Command {
  return { id, label: id, scope, keys }
}

describe("TUI command registry", () => {
  test("registers commands and looks them up by id", () => {
    const reg = createCommandRegistry()
    const cmd = createCommand("quit", "global", ["q"])
    reg.register(cmd)

    expect(reg.getById("quit")).toEqual(cmd)
  })

  test("returns undefined for unknown command id", () => {
    const reg = createCommandRegistry()

    expect(reg.getById("nonexistent")).toBeUndefined()
  })

  test("finds commands by key in the correct scope", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("quit", "global", ["q"]))
    reg.register(createCommand("toggleMissing", "projects", ["m"]))
    reg.register(createCommand("moveSessions", "sessions", ["m"]))

    expect(reg.findByKey("q", "global")?.id).toBe("quit")
    expect(reg.findByKey("m", "projects")?.id).toBe("toggleMissing")
    expect(reg.findByKey("m", "sessions")?.id).toBe("moveSessions")
  })

  test("global commands are accessible from any scope", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("quit", "global", ["q"]))
    reg.register(createCommand("toggleSort", "sessions", ["s"]))

    expect(reg.findByKey("q", "sessions")?.id).toBe("quit")
    expect(reg.findByKey("q", "projects")?.id).toBe("quit")
  })

  test("returns undefined when no command matches key in scope", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("toggleSort", "sessions", ["s"]))

    expect(reg.findByKey("s", "projects")).toBeUndefined()
  })

  test("lists all commands for a given scope including global", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("quit", "global", ["q"]))
    reg.register(createCommand("reload", "global", ["r"]))
    reg.register(createCommand("toggleMissing", "projects", ["m"]))
    reg.register(createCommand("deleteSession", "sessions", ["d"]))

    const projectCmds = reg.listByScope("projects")

    expect(projectCmds.map((c) => c.id)).toEqual(["quit", "reload", "toggleMissing"])
  })

  test("lists scope-only commands excluding global", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("quit", "global", ["q"]))
    reg.register(createCommand("toggleMissing", "projects", ["m"]))

    const localCmds = reg.listByScopeOnly("projects")

    expect(localCmds.map((c) => c.id)).toEqual(["toggleMissing"])
  })

  test("overwrites duplicate command id on re-register", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("quit", "global", ["q"]))
    reg.register(createCommand("quit", "global", ["Ctrl+C"]))

    expect(reg.getById("quit")?.keys).toEqual(["Ctrl+C"])
  })

  test("scope-specific command takes precedence over global when both match a key", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("help", "global", ["h"]))
    reg.register(createCommand("homeDismiss", "home", ["h"]))

    expect(reg.findByKey("h", "home")?.id).toBe("homeDismiss")
    expect(reg.findByKey("h", "sessions")?.id).toBe("help")
  })

  test("integration: full TUI key routing lookup returns correct command per scope", () => {
    const reg = createCommandRegistry()
    reg.register(createCommand("quit", "global", ["q"]))
    reg.register(createCommand("reload", "global", ["r"]))
    reg.register(createCommand("deleteProject", "projects", ["d"]))
    reg.register(createCommand("deleteSession", "sessions", ["d"]))
    reg.register(createCommand("closeChat", "chat", ["escape"]))
    reg.register(createCommand("clearSelection", "sessions", ["escape"]))

    expect(reg.findByKey("q", "home")?.id).toBe("quit")
    expect(reg.findByKey("r", "projects")?.id).toBe("reload")
    expect(reg.findByKey("d", "projects")?.id).toBe("deleteProject")
    expect(reg.findByKey("d", "sessions")?.id).toBe("deleteSession")
    expect(reg.findByKey("escape", "chat")?.id).toBe("closeChat")
    expect(reg.findByKey("escape", "sessions")?.id).toBe("clearSelection")
  })
})
