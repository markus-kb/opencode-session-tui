import { describe, expect, test } from "bun:test"
import {
  toCommandKey,
  toCommandScope,
  resolveCommand,
  type KeyRouteContext,
} from "../../src/tui/key-router"
import { buildTuiCommands } from "../../src/tui/command-definitions"
import { createInitialTuiState, openWorkspace } from "../../src/tui/app-state"
import type { TuiOverlay } from "../../src/tui/app-state"

function homeContext(overrides?: Partial<KeyRouteContext>): KeyRouteContext {
  return { screen: "home", overlay: null, searchActive: false, confirmActive: false, ...overrides }
}

function workspaceContext(tab: "projects" | "sessions" = "projects", overrides?: Partial<KeyRouteContext>): KeyRouteContext {
  return { screen: tab, overlay: null, searchActive: false, confirmActive: false, ...overrides }
}

describe("TUI key router", () => {
  describe("toCommandKey", () => {
    test("maps key.name to command key", () => {
      expect(toCommandKey({ name: "space", sequence: " ", ctrl: false, meta: false })).toBe("space")
      expect(toCommandKey({ name: "enter", sequence: "\r", ctrl: false, meta: false })).toBe("enter")
      expect(toCommandKey({ name: "escape", sequence: "\x1b", ctrl: false, meta: false })).toBe("escape")
    })

    test("maps letter key.sequence to command key", () => {
      expect(toCommandKey({ name: undefined, sequence: "q", ctrl: false, meta: false })).toBe("q")
      expect(toCommandKey({ name: undefined, sequence: "R", ctrl: false, meta: false })).toBe("R")
    })

    test("maps Ctrl+key to C- prefix", () => {
      expect(toCommandKey({ name: "c", sequence: "\x03", ctrl: true, meta: false })).toBe("C-c")
    })
  })

  describe("toCommandScope", () => {
    test("returns home when on home screen", () => {
      expect(toCommandScope(homeContext())).toBe("home")
    })

    test("returns confirm when confirmation dialog is active", () => {
      expect(toCommandScope(workspaceContext("projects", { confirmActive: true }))).toBe("confirm")
    })

    test("confirm scope takes precedence over chat overlay", () => {
      const overlay: TuiOverlay = { name: "chatViewer", sessionId: "s1" }
      expect(toCommandScope(workspaceContext("sessions", { overlay, confirmActive: true }))).toBe("confirm")
    })

    test("chat viewer scope takes precedence over chat search overlay shape only by active overlay", () => {
      const overlay: TuiOverlay = { name: "chatViewer", sessionId: "s1" }
      expect(toCommandScope(workspaceContext("sessions", { overlay, searchActive: true }))).toBe("chat")
    })

    test("returns chat when chat viewer overlay is active", () => {
      const overlay: TuiOverlay = { name: "chatViewer", sessionId: "s1" }
      expect(toCommandScope(workspaceContext("sessions", { overlay }))).toBe("chat")
    })

    test("returns search when chat search overlay is active", () => {
      const overlay: TuiOverlay = { name: "chatSearch" }
      expect(toCommandScope(workspaceContext("sessions", { overlay }))).toBe("search")
    })

    test("chat search overlay scope takes precedence over global tab search", () => {
      const overlay: TuiOverlay = { name: "chatSearch" }
      expect(toCommandScope(workspaceContext("sessions", { overlay, searchActive: true }))).toBe("search")
    })

    test("returns projects/sessions based on active tab when no overlay", () => {
      expect(toCommandScope(workspaceContext("projects"))).toBe("projects")
      expect(toCommandScope(workspaceContext("sessions"))).toBe("sessions")
    })
  })

  describe("resolveCommand", () => {
    const cmdSet = buildTuiCommands()

    test("resolves quit from any scope via global command", () => {
      expect(resolveCommand(cmdSet.registry, "q", homeContext())).toBe("quit")
      expect(resolveCommand(cmdSet.registry, "q", workspaceContext("projects"))).toBe("quit")
      expect(resolveCommand(cmdSet.registry, "q", workspaceContext("sessions"))).toBe("quit")
    })

    test("resolves home dismiss from home scope", () => {
      expect(resolveCommand(cmdSet.registry, "enter", homeContext())).toBe("homeDismiss")
      expect(resolveCommand(cmdSet.registry, "escape", homeContext())).toBe("homeDismiss")
    })

    test("resolves project panel commands in projects scope", () => {
      expect(resolveCommand(cmdSet.registry, "d", workspaceContext("projects"))).toBe("projects:deleteSelected")
      expect(resolveCommand(cmdSet.registry, "space", workspaceContext("projects"))).toBe("projects:toggleSelect")
    })

    test("resolves session panel commands in sessions scope", () => {
      expect(resolveCommand(cmdSet.registry, "d", workspaceContext("sessions"))).toBe("sessions:deleteSelected")
      expect(resolveCommand(cmdSet.registry, "s", workspaceContext("sessions"))).toBe("sessions:toggleSort")
      expect(resolveCommand(cmdSet.registry, "R", workspaceContext("sessions"))).toBe("sessions:renameSession")
    })

    test("resolves confirm dialog commands", () => {
      expect(resolveCommand(cmdSet.registry, "y", workspaceContext("projects", { confirmActive: true }))).toBe("confirm:ok")
      expect(resolveCommand(cmdSet.registry, "n", workspaceContext("projects", { confirmActive: true }))).toBe("confirm:cancel")
    })

    test("resolves chat viewer commands", () => {
      const overlay: TuiOverlay = { name: "chatViewer", sessionId: "s1" }
      expect(resolveCommand(cmdSet.registry, "escape", workspaceContext("sessions", { overlay }))).toBe("chat:close")
      expect(resolveCommand(cmdSet.registry, "up", workspaceContext("sessions", { overlay }))).toBe("chat:prev")
      expect(resolveCommand(cmdSet.registry, "down", workspaceContext("sessions", { overlay }))).toBe("chat:next")
      expect(resolveCommand(cmdSet.registry, "pageup", workspaceContext("sessions", { overlay }))).toBe("chat:pageUp")
      expect(resolveCommand(cmdSet.registry, "pagedown", workspaceContext("sessions", { overlay }))).toBe("chat:pageDown")
      expect(resolveCommand(cmdSet.registry, "home", workspaceContext("sessions", { overlay }))).toBe("chat:home")
      expect(resolveCommand(cmdSet.registry, "end", workspaceContext("sessions", { overlay }))).toBe("chat:end")
      expect(resolveCommand(cmdSet.registry, "s", workspaceContext("sessions", { overlay }))).toBe("chat:toggleSortOrder")
      expect(resolveCommand(cmdSet.registry, "y", workspaceContext("sessions", { overlay }))).toBe("chat:copy")
      expect(resolveCommand(cmdSet.registry, "C-u", workspaceContext("sessions", { overlay }))).toBe("chat:pageUp")
      expect(resolveCommand(cmdSet.registry, "C-d", workspaceContext("sessions", { overlay }))).toBe("chat:pageDown")
    })

    test("resolves chat search commands", () => {
      const overlay: TuiOverlay = { name: "chatSearch" }
      expect(resolveCommand(cmdSet.registry, "escape", workspaceContext("sessions", { overlay }))).toBe("search:close")
      expect(resolveCommand(cmdSet.registry, "enter", workspaceContext("sessions", { overlay }))).toBe("search:action")
      expect(resolveCommand(cmdSet.registry, "up", workspaceContext("sessions", { overlay }))).toBe("search:prev")
      expect(resolveCommand(cmdSet.registry, "down", workspaceContext("sessions", { overlay }))).toBe("search:next")
    })

    test("resolves all confirm dialog commands", () => {
      const ctx = workspaceContext("projects", { confirmActive: true })
      expect(resolveCommand(cmdSet.registry, "y", ctx)).toBe("confirm:ok")
      expect(resolveCommand(cmdSet.registry, "enter", ctx)).toBe("confirm:ok")
      expect(resolveCommand(cmdSet.registry, "n", ctx)).toBe("confirm:cancel")
      expect(resolveCommand(cmdSet.registry, "escape", ctx)).toBe("confirm:cancel")
    })

    test("confirm scope takes precedence over panel scope", () => {
      const ctx = workspaceContext("projects", { confirmActive: true })
      expect(resolveCommand(cmdSet.registry, "d", ctx)).toBeUndefined()
      expect(resolveCommand(cmdSet.registry, "space", ctx)).toBeUndefined()
    })

    test("chat scope takes precedence over session scope", () => {
      const overlay: TuiOverlay = { name: "chatViewer", sessionId: "s1" }
      const ctx = workspaceContext("sessions", { overlay })
      expect(resolveCommand(cmdSet.registry, "d", ctx)).toBeUndefined()
      expect(resolveCommand(cmdSet.registry, "R", ctx)).toBeUndefined()
    })

    test("search scope takes precedence over session scope", () => {
      const overlay: TuiOverlay = { name: "chatSearch" }
      const ctx = workspaceContext("sessions", { overlay })
      expect(resolveCommand(cmdSet.registry, "d", ctx)).toBeUndefined()
      expect(resolveCommand(cmdSet.registry, "R", ctx)).toBeUndefined()
    })

    test("returns undefined for unrecognized keys", () => {
      expect(resolveCommand(cmdSet.registry, "z", workspaceContext("projects"))).toBeUndefined()
    })
  })
})
