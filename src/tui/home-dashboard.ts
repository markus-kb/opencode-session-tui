import type { StorageBackend } from "../lib/opencode-data-provider"

export type HomeDashboardItem = {
  label: string
  value: string
}

export type HomeDashboardAction = {
  key: string
  label: string
}

export type HomeDashboardModel = {
  title: string
  subtitle: string
  storage: HomeDashboardItem[]
  library: HomeDashboardItem[]
  actions: HomeDashboardAction[]
}

export function getHomeDashboardModel(input: {
  backend: StorageBackend
  root: string
  dbPath: string | undefined
  tokenLabel: string
  sqliteAvailable: boolean
  legacyJsonAvailable: boolean
}): HomeDashboardModel {
  const storage: HomeDashboardItem[] = [
    { label: "Mode", value: input.backend === "hybrid" ? "Hybrid" : input.backend === "sqlite" ? "SQLite" : "JSONL" },
  ]

  if (input.backend === "sqlite" || input.backend === "hybrid") {
    storage.push({
      label: "SQLite",
      value: `${input.sqliteAvailable ? "available" : "missing"}: ${input.dbPath ?? "(default)"}`,
    })
  }

  if (input.backend === "jsonl" || input.backend === "hybrid") {
    storage.push({
      label: "Legacy JSON",
      value: `${input.legacyJsonAvailable ? "available" : "missing"}: ${input.root}`,
    })
  }

  return {
    title: "OpenCode Metadata Manager",
    subtitle: "Fast home dashboard. Workspace data loads only after you enter.",
    storage,
    library: [
      { label: "Projects", value: "deferred until workspace opens" },
      { label: "Sessions", value: "deferred until workspace opens" },
      { label: "Tokens", value: input.tokenLabel },
    ],
    actions: [
      { key: "Enter", label: "Open workspace" },
      { key: "1", label: "Projects" },
      { key: "2", label: "Sessions" },
      { key: "?", label: "Help" },
      { key: "Q", label: "Quit" },
    ],
  }
}
