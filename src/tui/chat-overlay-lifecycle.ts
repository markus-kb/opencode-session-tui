import type { ChatMessage, ChatSearchResult, SessionRecord } from "../lib/opencode-data"

export function openChatViewerState(): {
  chatMessages: ChatMessage[]
  chatCursor: 0
  chatLoading: true
  chatError: null
  chatPartsCache: Map<string, ChatMessage>
} {
  return {
    chatMessages: [],
    chatCursor: 0,
    chatLoading: true,
    chatError: null,
    chatPartsCache: new Map(),
  }
}

export function closeChatViewerState(): {
  chatSession: SessionRecord | null
  chatMessages: ChatMessage[]
  chatCursor: 0
  chatLoading: false
  chatError: null
  chatPartsCache: Map<string, ChatMessage>
} {
  return {
    chatSession: null,
    chatMessages: [],
    chatCursor: 0,
    chatLoading: false,
    chatError: null,
    chatPartsCache: new Map(),
  }
}

export function openChatSearchState(): {
  chatSearchQuery: ""
  chatSearchResults: ChatSearchResult[]
  chatSearchCursor: 0
  chatSearching: false
} {
  return {
    chatSearchQuery: "",
    chatSearchResults: [],
    chatSearchCursor: 0,
    chatSearching: false,
  }
}

export function closeChatSearchState(): {
  chatSearchQuery: ""
  chatSearchResults: ChatSearchResult[]
  chatSearchCursor: 0
  chatSearching: false
} {
  return {
    chatSearchQuery: "",
    chatSearchResults: [],
    chatSearchCursor: 0,
    chatSearching: false,
  }
}
