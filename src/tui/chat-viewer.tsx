import type { SelectOption } from "@opentui/core"
import { useEffect, useMemo } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { formatDate, type ChatMessage, type ChatPart, type SessionRecord } from "../lib/opencode-data"
import { sweepUnhydratedMessages } from "./chat-session-resource"
import { formatTokenCount } from "./format"
import { OverlayFrame, PALETTE, ShortcutHints } from "./components"

export const leftPaneStyle = {
  border: true,
  borderColor: PALETTE.muted,
  width: 42,
  flexShrink: 0,
  minWidth: 32,
  flexDirection: "column" as const,
  padding: 0,
  overflow: "hidden" as const,
}

function sanitizePreview(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  return compact.length > 0 ? compact : "[no preview]"
}

// Left pane is 42 cols wide, border eats 2, leaving 40 usable.
// Fixed prefix: marker(1) + space(1) + num(3) + space(1) + role(1) + space(1) + time(5) + space(1) = 14 chars.
// Preview budget = 40 - 14 = 26 chars.
const LEFT_PANE_INNER_WIDTH = 40
const ROW_PREFIX_WIDTH = 14
const PREVIEW_MAX_CHARS = LEFT_PANE_INNER_WIDTH - ROW_PREFIX_WIDTH  // 26

function clampSnippet(text: string, maxChars = PREVIEW_MAX_CHARS): string {
  if (text.length <= maxChars) return text
  return text.slice(0, Math.max(1, maxChars - 3)).trimEnd() + "..."
}

export function sortChatMessages(messages: ChatMessage[], sortOrder: "asc" | "desc"): ChatMessage[] {
  const sorted = [...messages].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0
    const bTime = b.createdAt?.getTime() ?? 0
    if (aTime !== bTime) return aTime - bTime
    return a.messageId.localeCompare(b.messageId)
  })
  return sortOrder === "asc" ? sorted : sorted.reverse()
}

export function buildChatMessageOption(msg: ChatMessage, idx: number): SelectOption {
  const roleLabel = msg.role === "user" ? "[user]" : msg.role === "assistant" ? "[asst]" : "[???]"
  const timestamp = msg.createdAt
    ? msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "??:??"
  const safePreview = sanitizePreview(msg.previewText)
  const preview = clampSnippet(safePreview)

  return {
    name: `${roleLabel} ${timestamp} - ${preview}`,
    description: "",
    value: idx,
  }
}

// Format: marker(1) space(1) number(3,right-aligned) space(1) role(1) space(1) time(5) space(1) preview
// Example: ">   1 U 22:33 hello world..."
// Example: "   42 A 10:01 [no preview]"
export function formatListRowLabel(msg: ChatMessage, idx: number, selected: boolean): string {
  const marker = selected ? ">" : " "
  const role = msg.role === "user" ? "U" : msg.role === "assistant" ? "A" : "?"
  const number = String(idx + 1).padStart(3, " ")
  const timestamp = msg.createdAt
    ? msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "??:??"
  const safePreview = clampSnippet(sanitizePreview(msg.previewText))
  return `${marker} ${number} ${role} ${timestamp} ${safePreview}`
}

export function buildVisibleMessageRows(
  messages: ChatMessage[],
  cursor: number,
  maxRows: number,
): { name: string; selected: boolean; key: string }[] {
  if (messages.length === 0) return []

  const safeCursor = Math.max(0, Math.min(messages.length - 1, cursor))
  const windowSize = Math.max(1, maxRows)
  const half = Math.floor(windowSize / 2)
  let start = Math.max(0, safeCursor - half)
  let end = Math.min(messages.length, start + windowSize)
  start = Math.max(0, end - windowSize)

  return messages.slice(start, end).map((msg, offset) => {
    const idx = start + offset
    const selected = idx === safeCursor
    return {
      key: msg.messageId,
      selected,
      name: formatListRowLabel(msg, idx, selected),
    }
  })
}

const MAX_RENDERED_PARTS = 40

export function getVisibleParts(message: ChatMessage): { parts: ChatPart[]; hiddenCount: number } {
  if (!message.parts) {
    return { parts: [], hiddenCount: 0 }
  }
  const parts = message.parts.slice(0, MAX_RENDERED_PARTS)
  const hiddenCount = Math.max(0, message.parts.length - parts.length)
  return { parts, hiddenCount }
}

export type ChatViewerProps = {
  session: SessionRecord
  messages: ChatMessage[]
  cursor: number
  sortOrder: "asc" | "desc"
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
  sortOrder,
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

  // Background sweep: hydrate all un-hydrated messages so their preview
  // text updates in the list without requiring the user to visit each one.
  useEffect(() => {
    sweepUnhydratedMessages(messages, onHydrateMessage)
  }, [messages, onHydrateMessage])

  const { height: terminalHeight } = useTerminalDimensions()
  // OverlayFrame: top(2)+bottom(2)+border(2)+padding(2) = 8 overhead rows.
  // Session row: 1. ShortcutHints + marginTop: 2. Left-pane border: 2. +1 buffer = 14.
  const maxRows = Math.max(4, terminalHeight - 14)

  const messageRows = useMemo(
    () => buildVisibleMessageRows(messages, cursor, maxRows),
    [messages, cursor, maxRows],
  )

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

    const visible = getVisibleParts(currentMessage)

    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        {visible.parts.map((part) => (
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
        {visible.hiddenCount > 0 ? (
          <text fg={PALETTE.muted}>
            Showing first {visible.parts.length} of {visible.parts.length + visible.hiddenCount} parts
          </text>
        ) : null}
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
      <box style={{ flexDirection: "row", flexShrink: 0 }}>
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
            style={leftPaneStyle}
            title="Messages"
          >
            <box style={{ flexDirection: "column", gap: 0, overflow: "hidden", flexGrow: 1 }}>
              {messageRows.map((row) => (
                <text key={row.selected ? `${row.key}:s` : row.key} fg={row.selected ? PALETTE.key : PALETTE.muted}>
                  {row.name}
                </text>
              ))}
            </box>
          </box>

          <box
              style={{
                border: true,
                borderColor: currentMessage?.role === "user" ? PALETTE.accent : PALETTE.primary,
                flexGrow: 1,
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
        <ShortcutHints
          prefix=""
          items={[
            { key: "Esc", label: "close" },
            { key: "Up/Down", label: "navigate" },
            { key: "PgUp/PgDn", label: "jump" },
            { key: "S", label: `sort ${sortOrder}` },
            { key: "Y", label: "copy message" },
          ]}
        />
      </box>
    </OverlayFrame>
  )
}
