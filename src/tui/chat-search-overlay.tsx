import { formatDate, type ChatSearchResult, type SessionRecord } from "../lib/opencode-data"
import { OverlayFrame, PALETTE } from "./components"

export type ChatSearchOverlayProps = {
  sessionFilter: string | null
  allSessions: SessionRecord[]
  query: string
  searching: boolean
  results: ChatSearchResult[]
  cursor: number
  onCursorChange: (index: number) => void
}

export const ChatSearchOverlay = ({
  sessionFilter,
  allSessions,
  query,
  searching,
  results,
  cursor,
  onCursorChange,
}: ChatSearchOverlayProps) => {
  const currentResult = results[cursor]
  const searchedSessionCount = sessionFilter
    ? allSessions.filter(s => s.projectId === sessionFilter).length
    : allSessions.length

  return (
    <OverlayFrame
      title={`Search Chat Content ${sessionFilter ? `(project: ${sessionFilter})` : "(all sessions)"}`}
      borderColor={PALETTE.info}
    >
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text fg={PALETTE.accent}>Search: </text>
        <text fg={PALETTE.key}>{query}</text>
        <text fg={PALETTE.muted}>_</text>
        {searching ? <text fg={PALETTE.info}> (searching...)</text> : null}
      </box>

      <box style={{ marginBottom: 1 }}>
        <text fg={PALETTE.muted}>
          Searching {searchedSessionCount} sessions | Found: {results.length} matches
        </text>
      </box>

      {results.length === 0 && query && !searching ? (
        <text fg={PALETTE.muted}>No results found. Try a different search term.</text>
      ) : results.length > 0 ? (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          <box
            style={{
              border: true,
              borderColor: PALETTE.muted,
              flexGrow: 4,
              flexDirection: "column",
              padding: 1,
            }}
            title="Results"
          >
            <select
              options={results.map((r, idx) => ({
                name: `${r.sessionTitle.slice(0, 25)} | ${r.role === "user" ? "[user]" : "[asst]"} ${r.matchedText.slice(0, 40)}...`,
                description: "",
                value: idx,
              }))}
              selectedIndex={cursor}
              onChange={onCursorChange}
              focused={true}
              showScrollIndicator
              wrapSelection={false}
            />
          </box>

          <box
            style={{
              border: true,
              borderColor: currentResult?.role === "user" ? PALETTE.accent : PALETTE.primary,
              flexGrow: 6,
              flexDirection: "column",
              padding: 1,
              overflow: "hidden",
            }}
            title={currentResult ? `${currentResult.role} message` : "Preview"}
          >
            {currentResult ? (
              <box style={{ flexDirection: "column" }}>
                <box style={{ flexDirection: "row", marginBottom: 1 }}>
                  <text fg={PALETTE.accent}>Session: </text>
                  <text>{currentResult.sessionTitle}</text>
                </box>
                <box style={{ flexDirection: "row", marginBottom: 1 }}>
                  <text fg={PALETTE.accent}>Time: </text>
                  <text>{formatDate(currentResult.createdAt)}</text>
                  <text fg={PALETTE.muted}> | </text>
                  <text fg={PALETTE.accent}>Type: </text>
                  <text>{currentResult.partType}</text>
                </box>
                <box style={{ flexGrow: 1 }}>
                  <text>{currentResult.fullText.slice(0, 1500)}{currentResult.fullText.length > 1500 ? "\n[... truncated]" : ""}</text>
                </box>
              </box>
            ) : (
              <text fg={PALETTE.muted}>Select a result to preview</text>
            )}
          </box>
        </box>
      ) : (
        <text fg={PALETTE.muted}>Type a search query and press Enter to search chat content.</text>
      )}

      <box style={{ marginTop: 1 }}>
        <text fg={PALETTE.muted}>
          Type query, Enter to search | Esc close | Up/Down navigate | Enter on result opens chat
        </text>
      </box>
    </OverlayFrame>
  )
}
