import type { TuiTab } from "./app-state"

export function executeWorkspaceReload({
  refreshTarget,
  status,
  clearTokenCache,
  refreshWorkspaceResources,
  refreshProjectsPanel,
  refreshSessionsPanel,
  notify,
}: {
  refreshTarget: TuiTab
  status: string
  clearTokenCache: () => void
  refreshWorkspaceResources: () => void
  refreshProjectsPanel: () => void
  refreshSessionsPanel: () => void
  notify: (message: string) => void
}): void {
  clearTokenCache()
  refreshWorkspaceResources()
  if (refreshTarget === "projects") {
    refreshProjectsPanel()
  } else {
    refreshSessionsPanel()
  }
  notify(status)
}
