import { describe, expect, test } from "bun:test"
import {
  closeChatSearchState,
  closeChatViewerState,
  openChatSearchState,
  openChatViewerState,
} from "../../src/tui/chat-overlay-lifecycle"

describe("chat overlay lifecycle", () => {
  test("opens chat viewer with reset cursor/loading/error/cache", () => {
    expect(openChatViewerState()).toEqual({
      chatMessages: [],
      chatCursor: 0,
      chatLoading: true,
      chatError: null,
      chatPartsCache: new Map(),
    })
  })

  test("closes chat viewer with cleared state", () => {
    expect(closeChatViewerState()).toEqual({
      chatSession: null,
      chatMessages: [],
      chatCursor: 0,
      chatLoading: false,
      chatError: null,
      chatPartsCache: new Map(),
    })
  })

  test("opens and closes chat search with reset state", () => {
    expect(openChatSearchState()).toEqual({
      chatSearchQuery: "",
      chatSearchResults: [],
      chatSearchCursor: 0,
      chatSearching: false,
    })

    expect(closeChatSearchState()).toEqual({
      chatSearchQuery: "",
      chatSearchResults: [],
      chatSearchCursor: 0,
      chatSearching: false,
    })
  })
})
