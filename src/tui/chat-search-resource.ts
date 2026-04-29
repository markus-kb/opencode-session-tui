import type { ChatSearchResult, SessionRecord } from "../lib/opencode-data"
import type { DataProvider } from "../lib/opencode-data-provider"
import { isChatSearchEnabled, type ResourcePolicy } from "./resource-policy"

export type ChatSearchResourceResult =
  | { kind: "deferred"; results: [] }
  | { kind: "loaded"; results: ChatSearchResult[] }

export function getChatSearchSessions(
  sessions: SessionRecord[],
  projectFilter: string | null,
): SessionRecord[] {
  return projectFilter ? sessions.filter((session) => session.projectId === projectFilter) : sessions
}

export async function searchChatSessions(
  provider: DataProvider,
  policy: ResourcePolicy,
  sessions: SessionRecord[],
  query: string,
): Promise<ChatSearchResourceResult> {
  if (!isChatSearchEnabled(policy)) {
    return { kind: "deferred", results: [] }
  }

  return { kind: "loaded", results: await provider.searchSessionsChat(sessions, query, { maxResults: 100 }) }
}
