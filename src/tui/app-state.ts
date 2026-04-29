import type { KeyEvent } from "@opentui/core"
import type { AggregateTokenSummary } from "../lib/opencode-data"

type KnownAggregateTokenSummary = AggregateTokenSummary & {
  total: Extract<AggregateTokenSummary["total"], { kind: "known" }>
}

export type TuiTab = "projects" | "sessions"

export type TuiScreen =
  | { name: "home" }
  | { name: "workspace"; activeTab: TuiTab }

export type TuiOverlay =
  | { name: "chatViewer"; sessionId: string }
  | { name: "chatSearch" }

export type TuiState = {
  screen: TuiScreen
  overlay: TuiOverlay | null
}

export type NavigationEvent =
  | { type: "openWorkspace"; activeTab?: TuiTab }
  | { type: "openHome" }
  | { type: "openChat"; sessionId: string }
  | { type: "openChatSearch" }
  | { type: "closeOverlay" }

export type WorkspaceDataLoadState =
  | { enabled: true }
  | { enabled: false; reason: "home" }

export type HomeKeyAction = "openWorkspace" | "quit" | "none"

export type GlobalTokenDisplayState =
  | { kind: "deferred"; label: "deferred" }
  | { kind: "loading"; label: "loading..." }
  | { kind: "unknown"; label: "?" }
  | { kind: "known"; summary: KnownAggregateTokenSummary }

type KeyLike = Pick<KeyEvent, "name" | "sequence" | "ctrl" | "meta">

export function createInitialTuiState(): TuiState {
  return { screen: { name: "home" }, overlay: null }
}

export function openWorkspace(state: TuiState, activeTab: TuiTab = "projects"): TuiState {
  return { ...state, screen: { name: "workspace", activeTab } }
}

export function openHome(state: TuiState): TuiState {
  return { ...state, screen: { name: "home" }, overlay: null }
}

export function openChatViewerOverlay(state: TuiState, sessionId: string): TuiState {
  return { ...state, overlay: { name: "chatViewer", sessionId } }
}

export function openChatSearchOverlay(state: TuiState): TuiState {
  return { ...state, overlay: { name: "chatSearch" } }
}

export function closeOverlay(state: TuiState): TuiState {
  return { ...state, overlay: null }
}

export function getActiveOverlay(state: TuiState): TuiOverlay["name"] | null {
  return state.overlay?.name ?? null
}

export function switchWorkspaceTab(state: TuiState, direction: "next" | "prev" | TuiTab): TuiState {
  if (direction === "projects" || direction === "sessions") {
    return openWorkspace(state, direction)
  }

  if (state.screen.name === "home") {
    return openWorkspace(state, "projects")
  }

  return openWorkspace(state, state.screen.activeTab === "projects" ? "sessions" : "projects")
}

export function applyNavigationEvent(state: TuiState, event: NavigationEvent): TuiState {
  switch (event.type) {
    case "openWorkspace":
      return openWorkspace(state, event.activeTab)
    case "openHome":
      return openHome(state)
    case "openChat":
      return openChatViewerOverlay(state, event.sessionId)
    case "openChatSearch":
      return openChatSearchOverlay(state)
    case "closeOverlay":
      return closeOverlay(state)
  }
}

export function getWorkspaceDataLoadState(state: TuiState): WorkspaceDataLoadState {
  if (state.screen.name === "home") {
    return { enabled: false, reason: "home" }
  }
  return { enabled: true }
}

export function getHomeKeyAction(key: KeyLike): HomeKeyAction {
  const letter = key.sequence?.toLowerCase()

  if (letter === "q" || (key.ctrl && key.name === "c")) {
    return "quit"
  }

  if (key.name === "escape" || key.name === "return" || key.name === "enter") {
    return "openWorkspace"
  }

  return "none"
}

export function getGlobalTokenDisplayState(
  summary: AggregateTokenSummary | null,
  loadState: WorkspaceDataLoadState,
): GlobalTokenDisplayState {
  if (!loadState.enabled) {
    return { kind: "deferred", label: "deferred" }
  }

  if (!summary) {
    return { kind: "loading", label: "loading..." }
  }

  if (summary.total.kind === "unknown") {
    return { kind: "unknown", label: "?" }
  }

  return { kind: "known", summary: summary as KnownAggregateTokenSummary }
}
