import type { AggregateTokenSummary, SessionRecord, TokenSummary } from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import { isTokenSummaryEnabled, type ResourcePolicy } from "./resource-policy"

export async function computeProjectTokens(
  provider: DataProvider,
  policy: ResourcePolicy,
  projectId: string,
  sessions: SessionRecord[],
): Promise<AggregateTokenSummary | null> {
  if (!isTokenSummaryEnabled(policy) || sessions.length === 0) {
    return null
  }

  return provider.computeProjectTokenSummary(projectId, sessions)
}

export async function computeSessionTokens(
  provider: DataProvider,
  policy: ResourcePolicy,
  session: SessionRecord | null,
): Promise<TokenSummary | null> {
  if (!isTokenSummaryEnabled(policy) || !session) {
    return null
  }

  return provider.computeSessionTokenSummary(session)
}

export async function computeFilteredProjectTokens(
  provider: DataProvider,
  policy: ResourcePolicy,
  projectFilter: string | null,
  sessions: SessionRecord[],
): Promise<AggregateTokenSummary | null> {
  if (!isTokenSummaryEnabled(policy) || !projectFilter) {
    return null
  }

  return provider.computeProjectTokenSummary(projectFilter, sessions)
}
