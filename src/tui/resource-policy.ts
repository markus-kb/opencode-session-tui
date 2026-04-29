import type { TuiState, WorkspaceDataLoadState } from "./app-state"

export type ResourcePolicy = {
  projects: "deferred" | "metadata"
  sessions: "deferred" | "metadata"
  tokens: "deferred" | "summary"
  chat: "deferred" | "index" | "search"
}

export function getResourcePolicy(state: TuiState): ResourcePolicy {
  if (state.screen.name === "home") {
    return {
      projects: "deferred",
      sessions: "deferred",
      tokens: "deferred",
      chat: "deferred",
    }
  }

  return {
    projects: "metadata",
    sessions: "metadata",
    tokens: "summary",
    chat: state.overlay?.name === "chatViewer" ? "index" : state.overlay?.name === "chatSearch" ? "search" : "deferred",
  }
}

export function isSessionMetadataEnabled(policy: ResourcePolicy): boolean {
  return policy.sessions === "metadata"
}

export function isProjectMetadataEnabled(policy: ResourcePolicy): boolean {
  return policy.projects === "metadata"
}

export function isTokenSummaryEnabled(policy: ResourcePolicy): boolean {
  return policy.tokens === "summary"
}

export function toWorkspaceDataLoadState(policy: ResourcePolicy): WorkspaceDataLoadState {
  if (policy.projects === "deferred" && policy.sessions === "deferred") {
    return { enabled: false, reason: "home" }
  }
  return { enabled: true }
}
