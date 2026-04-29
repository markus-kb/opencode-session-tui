import type { TuiTab } from "./app-state"

export type ProjectSessionsNavigation = {
  activeTab: Extract<TuiTab, "sessions">
  sessionFilter: string
  status: string
}

export function getProjectSessionsNavigation(projectId: string): ProjectSessionsNavigation {
  return {
    activeTab: "sessions",
    sessionFilter: projectId,
    status: `Filtering sessions by ${projectId}`,
  }
}
