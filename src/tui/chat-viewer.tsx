import type { SelectOption } from "@opentui/core"
import { useEffect, useMemo } from "react"
import { formatDate, type ChatMessage, type SessionRecord } from "../lib/opencode-data"
import { formatTokenCount } from "./format"
import { OverlayFrame, PALETTE } from "./components"

export type ChatViewerProps = {
  session: SessionRecord
  messages: ChatMessage[]
  cursor: number
  onCursorChange: (index: number) => void
  loading: boolean
  error: string | null
  onClose: () => void
  onHydrateMessage: (message: ChatMessage) => void
  onCopyMessage: (message: ChatMessage) => void
}

export const ChatViewer = ({
  session,
  messages,
  cursor,
  onCursorChange,
  loading,
  error,
  onHydrateMessage,
}: ChatViewerProps) => {
  const currentMessage = messages[cursor]

  useEffect(() => {
    if (currentMessage && currentMessage.parts === null) {
      onHydrateMessage(currentMessage)
    }
  }, [currentMessage, onHydrateMessage])

  const messageOptions: SelectOption[] = useMemo(() => {
    return messages.map((msg, idx) => {
      const roleLabel = msg.role === "user" ? "[user]" : msg.role === "assistant" ? "[asst]" : "[???]"
      const timestamp = msg.createdAt
        ? msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "??:??"
      const preview = msg.previewText.slice(0, 60) + (msg.previewText.length > 60 ? "..." : "")
      return {
        name: `${roleLabel} ${timestamp} - ${preview}`,
        description: "",
        value: idx,
      }
    })
  }, [messages])

  const renderMessageContent = () => {
    if (!currentMessage) {
      return <text fg={PALETTE.muted}>No message selected</text>
    }

    if (currentMessage.parts === null) {
      return <text fg={PALETTE.muted}>Loading message content...</text>
    }

    if (currentMessage.parts.length === 0) {
      return <text fg={PALETTE.muted}>[no content]</text>
    }

    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        {currentMessage.parts.map((part) => (
          <box key={part.partId} style={{ flexDirection: "column" }}>
            {part.type === "tool" ? (
              <text fg={PALETTE.accent}>
                [tool: {part.toolName ?? "unknown"}] {part.toolStatus ?? ""}
              </text>
            ) : part.type === "subtask" ? (
              <text fg={PALETTE.info}>[subtask]</text>
            ) : null}
            <text>{part.text.slice(0, 2000)}{part.text.length > 2000 ? "\n[... truncated]" : ""}</text>
          </box>
        ))}
        {currentMessage.totalChars !== null && currentMessage.totalChars > 2000 ? (
          <text fg={PALETTE.muted}>
            Showing first 2000 chars of {currentMessage.totalChars} total
          </text>
        ) : null}
      </box>
    )
  }

  const title = session.title && session.title.trim() ? session.title : session.sessionId

  return (
    <OverlayFrame title={`Chat: ${title} (READ-ONLY)`} borderColor={PALETTE.primary}>
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text fg={PALETTE.accent}>Session: </text>
        <text>{session.sessionId}</text>
        <text fg={PALETTE.muted}> | </text>
        <text fg={PALETTE.accent}>Project: </text>
        <text>{session.projectId}</text>
        <text fg={PALETTE.muted}> | </text>
        <text fg={PALETTE.accent}>Messages: </text>
        <text>{messages.length}</text>
        {loading ? <text fg={PALETTE.key}> (loading...)</text> : null}
      </box>

      {error ? (
        <text fg={PALETTE.danger}>Error: {error}</text>
      ) : messages.length === 0 && !loading ? (
        <text fg={PALETTE.muted}>No messages found in this session.</text>
      ) : (
        <box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
          <box
            style={{
              border: true,
              borderColor: PALETTE.muted,
              flexGrow: 4,
              flexDirection: "column",
              padding: 1,
            }}
            title="Messages"
          >
            <select
              options={messageOptions}
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
              borderColor: currentMessage?.role === "user" ? PALETTE.accent : PALETTE.primary,
              flexGrow: 6,
              flexDirection: "column",
              padding: 1,
              overflow: "hidden",
            }}
            title={currentMessage ? `${currentMessage.role} message` : "Details"}
          >
            {currentMessage ? (
              <box style={{ flexDirection: "column" }}>
                <box style={{ flexDirection: "row", marginBottom: 1 }}>
                  <text fg={PALETTE.accent}>Role: </text>
                  <text fg={currentMessage.role === "user" ? PALETTE.accent : PALETTE.primary}>
                    {currentMessage.role}
                  </text>
                  <text fg={PALETTE.muted}> | </text>
                  <text fg={PALETTE.accent}>Time: </text>
                  <text>{formatDate(currentMessage.createdAt)}</text>
                </box>
                {currentMessage.tokens ? (
                  <box style={{ flexDirection: "row", marginBottom: 1 }}>
                    <text fg={PALETTE.info}>Tokens: </text>
                    <text>
                      In: {formatTokenCount(currentMessage.tokens.input)} |
                      Out: {formatTokenCount(currentMessage.tokens.output)} |
                      Total: {formatTokenCount(currentMessage.tokens.total)}
                    </text>
                  </box>
                ) : null}
                <box style={{ flexGrow: 1, overflow: "hidden" }}>
                  {renderMessageContent()}
                </box>
              </box>
            ) : (
              <text fg={PALETTE.muted}>Select a message to view details</text>
            )}
          </box>
        </box>
      )}

      <box style={{ marginTop: 1 }}>
        <text fg={PALETTE.muted}>
          Esc close | Up/Down navigate | PgUp/PgDn jump | Y copy message
        </text>
      </box>
    </OverlayFrame>
  )
}
