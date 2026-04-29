import { describe, expect, test } from "bun:test"
import { buildTuiCommands } from "../../src/tui/command-definitions"

describe("TUI command definitions", () => {
  test("registers all global commands", () => {
    const cmdSet = buildTuiCommands()

    expect(cmdSet.registry.getById("quit")?.scope).toBe("global")
    expect(cmdSet.registry.getById("help")?.scope).toBe("global")
    expect(cmdSet.registry.getById("search")?.scope).toBe("global")
    expect(cmdSet.registry.getById("clearSearch")?.scope).toBe("global")
    expect(cmdSet.registry.getById("nextTab")?.scope).toBe("global")
    expect(cmdSet.registry.getById("tab1")?.scope).toBe("global")
    expect(cmdSet.registry.getById("tab2")?.scope).toBe("global")
    expect(cmdSet.registry.getById("reload")?.scope).toBe("global")
  })

  test("registers all home commands", () => {
    const cmdSet = buildTuiCommands()

    expect(cmdSet.registry.getById("homeDismiss")?.scope).toBe("home")
  })

  test("registers all project panel commands", () => {
    const cmdSet = buildTuiCommands()

    const scope = "projects"
    expect(cmdSet.registry.findByKey("space", scope)?.id).toBe("projects:toggleSelect")
    expect(cmdSet.registry.findByKey("m", scope)?.id).toBe("projects:toggleMissing")
    expect(cmdSet.registry.findByKey("a", scope)?.id).toBe("projects:selectAll")
    expect(cmdSet.registry.findByKey("escape", scope)?.id).toBe("projects:clearSelection")
    expect(cmdSet.registry.findByKey("d", scope)?.id).toBe("projects:deleteSelected")
    expect(cmdSet.registry.findByKey("enter", scope)?.id).toBe("projects:navigateToSessions")
  })

  test("registers all session panel commands", () => {
    const cmdSet = buildTuiCommands()

    const scope = "sessions"
    expect(cmdSet.registry.findByKey("space", scope)?.id).toBe("sessions:toggleSelect")
    expect(cmdSet.registry.findByKey("a", scope)?.id).toBe("sessions:selectAll")
    expect(cmdSet.registry.findByKey("s", scope)?.id).toBe("sessions:toggleSort")
    expect(cmdSet.registry.findByKey("c", scope)?.id).toBe("sessions:clearFilter")
    expect(cmdSet.registry.findByKey("escape", scope)?.id).toBe("sessions:clearSelection")
    expect(cmdSet.registry.findByKey("d", scope)?.id).toBe("sessions:deleteSelected")
    expect(cmdSet.registry.findByKey("y", scope)?.id).toBe("sessions:copyId")
    expect(cmdSet.registry.findByKey("R", scope)?.id).toBe("sessions:renameSession")
    expect(cmdSet.registry.findByKey("m", scope)?.id).toBe("sessions:moveSessions")
    expect(cmdSet.registry.findByKey("p", scope)?.id).toBe("sessions:copySessions")
    expect(cmdSet.registry.findByKey("v", scope)?.id).toBe("sessions:viewChat")
  })

  test("registers chat viewer commands", () => {
    const cmdSet = buildTuiCommands()

    const scope = "chat"
    expect(cmdSet.registry.findByKey("escape", scope)?.id).toBe("chat:close")
    expect(cmdSet.registry.findByKey("up", scope)?.id).toBe("chat:prev")
    expect(cmdSet.registry.findByKey("down", scope)?.id).toBe("chat:next")
    expect(cmdSet.registry.findByKey("pageup", scope)?.id).toBe("chat:pageUp")
    expect(cmdSet.registry.findByKey("pagedown", scope)?.id).toBe("chat:pageDown")
    expect(cmdSet.registry.findByKey("home", scope)?.id).toBe("chat:home")
    expect(cmdSet.registry.findByKey("end", scope)?.id).toBe("chat:end")
    expect(cmdSet.registry.findByKey("y", scope)?.id).toBe("chat:copy")
    expect(cmdSet.registry.findByKey("C-u", scope)?.id).toBe("chat:pageUp")
    expect(cmdSet.registry.findByKey("C-d", scope)?.id).toBe("chat:pageDown")
  })

  test("registers chat search commands", () => {
    const cmdSet = buildTuiCommands()

    const scope = "search"
    expect(cmdSet.registry.findByKey("escape", scope)?.id).toBe("search:close")
    expect(cmdSet.registry.findByKey("enter", scope)?.id).toBe("search:action")
    expect(cmdSet.registry.findByKey("up", scope)?.id).toBe("search:prev")
    expect(cmdSet.registry.findByKey("down", scope)?.id).toBe("search:next")
  })

  test("registers confirm dialog commands", () => {
    const cmdSet = buildTuiCommands()

    const scope = "confirm"
    expect(cmdSet.registry.findByKey("escape", scope)?.id).toBe("confirm:cancel")
    expect(cmdSet.registry.findByKey("n", scope)?.id).toBe("confirm:cancel")
    expect(cmdSet.registry.findByKey("enter", scope)?.id).toBe("confirm:ok")
    expect(cmdSet.registry.findByKey("y", scope)?.id).toBe("confirm:ok")
  })

  test("global commands are accessible from panel scopes", () => {
    const cmdSet = buildTuiCommands()

    expect(cmdSet.registry.findByKey("q", "sessions")?.id).toBe("quit")
    expect(cmdSet.registry.findByKey("r", "projects")?.id).toBe("reload")
  })

  test("generates home key reference content from registry", () => {
    const cmdSet = buildTuiCommands()

    const lines = cmdSet.getHomeKeyReference()

    expect(lines.length).toBeGreaterThan(0)
    expect(lines.some((l) => l.includes("Quit"))).toBe(true)
    expect(lines.some((l) => l.includes("Help"))).toBe(true)
  })

  test("getScopedKeyReference returns sections for each scope", () => {
    const cmdSet = buildTuiCommands()

    const sections = cmdSet.getScopedKeyReference()

    const scopeNames = sections.map(s => s.scope)
    expect(scopeNames).toContain("global")
    expect(scopeNames).toContain("home")
    expect(scopeNames).toContain("projects")
    expect(scopeNames).toContain("sessions")
    expect(scopeNames).toContain("chat")
    expect(scopeNames).toContain("search")
    expect(scopeNames).toContain("confirm")

    const globalSection = sections.find(s => s.scope === "global")!
    expect(globalSection.commands.length).toBeGreaterThan(0)
    expect(globalSection.commands.every(c => c.id && c.label && c.keys.length > 0)).toBe(true)

    const sessionSection = sections.find(s => s.scope === "sessions")!
    expect(sessionSection.commands.some(c => c.id === "quit")).toBe(false)
    expect(sessionSection.commands.some(c => c.id === "sessions:viewChat")).toBe(true)
  })
})
