import type { AggregateTokenSummary, SessionRecord } from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import { isSessionMetadataEnabled, isTokenSummaryEnabled, type ResourcePolicy } from "./resource-policy"

export type SessionIndexResult =
  | { kind: "deferred"; records: [] }
  | { kind: "loaded"; records: SessionRecord[] }

export async function loadSessionIndex(
  provider: DataProvider,
  policy: ResourcePolicy,
): Promise<SessionIndexResult> {
  if (!isSessionMetadataEnabled(policy)) {
    return { kind: "deferred", records: [] }
  }

  return { kind: "loaded", records: await provider.loadSessionRecords() }
}

export async function loadGlobalTokensFromSessionIndex(
  provider: DataProvider,
  policy: ResourcePolicy,
  sessions: SessionRecord[],
): Promise<AggregateTokenSummary | null> {
  if (!isTokenSummaryEnabled(policy)) {
    return null
  }

  return provider.computeGlobalTokenSummary(sessions)
}
