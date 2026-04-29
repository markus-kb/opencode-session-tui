import { describe, expect, test } from "bun:test"
import {
  createInitialTuiState,
  getHomeKeyAction,
  getWorkspaceDataLoadState,
  getGlobalTokenDisplayState,
  openHome,
  openWorkspace,
  switchWorkspaceTab,
} from "../../src/tui/app-state"

describe("TUI app state", () => {
  test("starts on the home screen with workspace data loading deferred", () => {
    const state = createInitialTuiState()

    expect(state.screen.name).toBe("home")
    expect(getWorkspaceDataLoadState(state).enabled).toBe(false)
  })

  test("enables workspace data loading only after leaving home", () => {
    const home = createInitialTuiState()
    const workspace = { ...home, screen: { name: "workspace", activeTab: "projects" as const } }

    expect(getWorkspaceDataLoadState(home)).toEqual({ enabled: false, reason: "home" })
    expect(getWorkspaceDataLoadState(workspace)).toEqual({ enabled: true })
  })

  test("opens workspace on the requested tab", () => {
    expect(openWorkspace(createInitialTuiState()).screen).toEqual({
      name: "workspace",
      activeTab: "projects",
    })

    expect(openWorkspace(createInitialTuiState(), "sessions").screen).toEqual({
      name: "workspace",
      activeTab: "sessions",
    })
  })

  test("returns to home without preserving workspace loading", () => {
    const state = openHome(openWorkspace(createInitialTuiState(), "sessions"))

    expect(state.screen).toEqual({ name: "home" })
    expect(getWorkspaceDataLoadState(state)).toEqual({ enabled: false, reason: "home" })
  })

  test("switches workspace tabs explicitly", () => {
    const projects = openWorkspace(createInitialTuiState(), "projects")

    expect(switchWorkspaceTab(projects, "next").screen).toEqual({
      name: "workspace",
      activeTab: "sessions",
    })
    expect(switchWorkspaceTab(projects, "sessions").screen).toEqual({
      name: "workspace",
      activeTab: "sessions",
    })
  })

  test("switching tabs from home opens the workspace", () => {
    expect(switchWorkspaceTab(createInitialTuiState(), "sessions").screen).toEqual({
      name: "workspace",
      activeTab: "sessions",
    })
  })

  test("maps home dismiss keys to workspace entry", () => {
    expect(getHomeKeyAction({ name: "return" })).toBe("openWorkspace")
    expect(getHomeKeyAction({ name: "enter" })).toBe("openWorkspace")
    expect(getHomeKeyAction({ name: "escape" })).toBe("openWorkspace")
    expect(getHomeKeyAction({ sequence: "?" })).toBe("openWorkspace")
    expect(getHomeKeyAction({ sequence: "h" })).toBe("openWorkspace")
    expect(getHomeKeyAction({ sequence: "H" })).toBe("openWorkspace")
  })

  test("maps quit keys on home without requiring workspace data", () => {
    expect(getHomeKeyAction({ sequence: "q" })).toBe("quit")
    expect(getHomeKeyAction({ name: "c", ctrl: true })).toBe("quit")
  })

  test("ignores unrelated home keys", () => {
    expect(getHomeKeyAction({ sequence: "x" })).toBe("none")
    expect(getHomeKeyAction({ name: "up" })).toBe("none")
  })

  test("does not show token loading text while home intentionally defers loading", () => {
    expect(getGlobalTokenDisplayState(null, { enabled: false, reason: "home" })).toEqual({
      kind: "deferred",
      label: "deferred",
    })
  })

  test("shows loading text after workspace data loading is enabled", () => {
    expect(getGlobalTokenDisplayState(null, { enabled: true })).toEqual({
      kind: "loading",
      label: "loading...",
    })
  })
})
