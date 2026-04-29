import type { KeyEvent } from "@opentui/core"
import type { AggregateTokenSummary } from "../lib/opencode-data"

type KnownAggregateTokenSummary = AggregateTokenSummary & {
  total: Extract<AggregateTokenSummary["total"], { kind: "known" }>
}

export type TuiTab = "projects" | "sessions"

export type TuiScreen =
  | { name: "home" }
  | { name: "workspace"; activeTab: TuiTab }

export type TuiState = {
  screen: TuiScreen
}

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
  return { screen: { name: "home" } }
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

  if (
    key.name === "escape" ||
    key.name === "return" ||
    key.name === "enter" ||
    letter === "?" ||
    letter === "h"
  ) {
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
