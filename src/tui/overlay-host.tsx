import type { ChatMessage, ChatSearchResult, SessionRecord } from "../lib/opencode-data"
import { ChatSearchOverlay } from "./chat-search-overlay"
import { ChatViewer } from "./chat-viewer"

export type OverlayHostProps = {
  chatViewerOpen: boolean
  chatSession: SessionRecord | null
  chatMessages: ChatMessage[]
  chatCursor: number
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
  return (
    <>
      {chatViewerOpen && chatSession ? (
        <ChatViewer
          session={chatSession}
          messages={chatMessages}
          cursor={chatCursor}
          onCursorChange={onChatCursorChange}
          loading={chatLoading}
          error={chatError}
          onClose={onCloseChatViewer}
          onHydrateMessage={onHydrateMessage}
          onCopyMessage={onCopyMessage}
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
