import { describe, expect, test } from "bun:test"
import { ChatSearchOverlay } from "../../src/tui/chat-search-overlay"

describe("ChatSearchOverlay", () => {
  test("exports the chat search overlay component", () => {
    expect(typeof ChatSearchOverlay).toBe("function")
  })
})
