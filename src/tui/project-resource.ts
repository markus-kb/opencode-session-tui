import type { ProjectRecord, SessionRecord } from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import { isProjectMetadataEnabled, type ResourcePolicy } from "./resource-policy"

export type ProjectIndexResult =
  | { kind: "deferred"; records: [] }
  | { kind: "loaded"; records: ProjectRecord[] }

export async function loadProjectIndex(
  provider: DataProvider,
  policy: ResourcePolicy,
): Promise<ProjectIndexResult> {
  if (!isProjectMetadataEnabled(policy)) {
    return { kind: "deferred", records: [] }
  }

  return { kind: "loaded", records: await provider.loadProjectRecords() }
}

export function filterSessionsByProject(
  sessions: SessionRecord[],
  projectId: string | undefined,
): SessionRecord[] {
  if (projectId === undefined) {
    return sessions
  }

  return sessions.filter((s) => s.projectId === projectId)
}
