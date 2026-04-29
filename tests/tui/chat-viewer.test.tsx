import { describe, expect, test } from "bun:test"
import { ChatViewer } from "../../src/tui/chat-viewer"

describe("ChatViewer", () => {
  test("exports the chat viewer overlay component", () => {
    expect(typeof ChatViewer).toBe("function")
  })
})
