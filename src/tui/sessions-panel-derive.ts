import type { SessionRecord } from "../lib/opencode-data"
import { createSearcher, type SearchCandidate } from "../lib/search"

export type SessionSortMode = "updated" | "created"

export function deriveVisibleSessions(
  records: SessionRecord[],
  query: string,
  sortMode: SessionSortMode,
): SessionRecord[] {
  const sorted = [...records].sort((a, b) => {
    const aDate = sortMode === "created" ? (a.createdAt ?? a.updatedAt) : (a.updatedAt ?? a.createdAt)
    const bDate = sortMode === "created" ? (b.createdAt ?? b.updatedAt) : (b.updatedAt ?? b.createdAt)
    const aTime = aDate?.getTime() ?? 0
    const bTime = bDate?.getTime() ?? 0
    if (bTime !== aTime) return bTime - aTime
    return a.sessionId.localeCompare(b.sessionId)
  })

  const trimmed = query.trim()
  if (!trimmed) {
    return sorted
  }

  const candidates: SearchCandidate<SessionRecord>[] = sorted.map((session) => ({
    item: session,
    searchText: [session.title || "", session.sessionId, session.directory || "", session.projectId]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  }))

  const searcher = createSearcher(candidates)
  const matches = searcher.search(trimmed, { returnMatchData: true })

  const ranked = matches
    .map((match) => {
      const session = match.item.item
      const createdMs = session.createdAt?.getTime() ?? 0
      const updatedMs = (session.updatedAt ?? session.createdAt)?.getTime() ?? 0
      return {
        session,
        score: match.score,
        timeMs: sortMode === "created" ? createdMs : updatedMs,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs
      return a.session.sessionId.localeCompare(b.session.sessionId)
    })
    .map((m) => m.session)

  const MAX_RESULTS = 200
  return ranked.length > MAX_RESULTS ? ranked.slice(0, MAX_RESULTS) : ranked
}
