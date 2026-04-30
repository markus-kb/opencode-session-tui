import type { TuiTab } from "./app-state"

export type WorkspaceReloadPlan = {
  refreshTarget: TuiTab
  status: string
}

export function getWorkspaceReloadPlan(activeTab: TuiTab): WorkspaceReloadPlan {
  return {
    refreshTarget: activeTab,
    status: "Reload requested...",
  }
}
