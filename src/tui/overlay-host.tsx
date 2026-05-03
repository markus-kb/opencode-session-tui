import { useTerminalDimensions } from "@opentui/react"
import type { ChatMessage, ChatSearchResult, SessionRecord } from "../lib/opencode-data"
import { ChatSearchOverlay } from "./chat-search-overlay"
import { ChatViewer } from "./chat-viewer"

export type OverlayHostProps = {
  chatViewerOpen: boolean
  chatSession: SessionRecord | null
  chatMessages: ChatMessage[]
  chatCursor: number
  chatSortOrder: "asc" | "desc"
  onChatCursorChange: (index: number) => void
  chatLoading: boolean
  chatError: string | null
  onCloseChatViewer: () => void
  onHydrateMessage: (message: ChatMessage) => void
  onCopyMessage: (message: ChatMessage) => void
  chatSearchOpen: boolean
  sessionFilter: string | null
  allSessions: SessionRecord[]
  chatSearchQuery: string
  chatSearching: boolean
  chatSearchResults: ChatSearchResult[]
  chatSearchCursor: number
  onChatSearchCursorChange: (index: number) => void
}

export const OverlayHost = ({
  chatViewerOpen,
  chatSession,
  chatMessages,
  chatCursor,
  chatSortOrder,
  onChatCursorChange,
  chatLoading,
  chatError,
  onCloseChatViewer,
  onHydrateMessage,
  onCopyMessage,
  chatSearchOpen,
  sessionFilter,
  allSessions,
  chatSearchQuery,
  chatSearching,
  chatSearchResults,
  chatSearchCursor,
  onChatSearchCursorChange,
}: OverlayHostProps) => {
  const { height: terminalHeight } = useTerminalDimensions()
  // OverlayFrame: top(2)+bottom(2)+border(2)+padding(2) = 8 overhead.
  // Session row: 1. ShortcutHints: 1. Left-pane border: 2. +2 buffer = 14.
  const maxRows = Math.max(4, terminalHeight - 14)

  return (
    <>
      {chatViewerOpen && chatSession ? (
        <ChatViewer
          session={chatSession}
          messages={chatMessages}
          cursor={chatCursor}
          sortOrder={chatSortOrder}
          onCursorChange={onChatCursorChange}
          loading={chatLoading}
          error={chatError}
          onClose={onCloseChatViewer}
          onHydrateMessage={onHydrateMessage}
          onCopyMessage={onCopyMessage}
          maxRows={maxRows}
        />
      ) : null}

      {chatSearchOpen ? (
        <ChatSearchOverlay
          sessionFilter={sessionFilter}
          allSessions={allSessions}
          query={chatSearchQuery}
          searching={chatSearching}
          results={chatSearchResults}
          cursor={chatSearchCursor}
          onCursorChange={onChatSearchCursorChange}
        />
      ) : null}
    </>
  )
}
