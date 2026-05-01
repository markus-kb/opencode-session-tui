import { applyNavigationEvent, type TuiState } from "./app-state"
import { getResourcePolicy, type ResourcePolicy } from "./resource-policy"

export function policyForOpenChatViewer(state: TuiState, sessionId: string): ResourcePolicy {
  return getResourcePolicy(applyNavigationEvent(state, { type: "openChat", sessionId }))
}

export function policyForOpenChatSearch(state: TuiState): ResourcePolicy {
  return getResourcePolicy(applyNavigationEvent(state, { type: "openChatSearch" }))
}
