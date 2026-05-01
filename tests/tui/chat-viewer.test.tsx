import { describe, expect, test } from "bun:test"
import type { ChatMessage } from "../../src/lib/opencode-data"
import {
  ChatViewer,
  buildChatMessageOption,
  buildVisibleMessageRows,
  getVisibleParts,
  leftPaneStyle,
  sortChatMessages,
} from "../../src/tui/chat-viewer"

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    sessionId: "session-1",
    messageId: "msg-1",
    role: "assistant",
    createdAt: new Date("2026-01-01T10:30:00Z"),
    parts: null,
    previewText: "hello world",
    totalChars: null,
    ...overrides,
  }
}

describe("ChatViewer", () => {
  test("exports the chat viewer overlay component", () => {
    expect(typeof ChatViewer).toBe("function")
  })

  test("keeps left pane visible with no shrink and minimum width", () => {
    expect(leftPaneStyle.minWidth).toBe(32)
    expect(leftPaneStyle.flexShrink).toBe(0)
    expect(leftPaneStyle.width).toBe(42)
  })

  test("builds chat message option with safe fallback preview", () => {
    const msg = createMessage({ previewText: "\n   \t" })
    const option = buildChatMessageOption(msg, 0)

    expect(option.name).toContain("[no preview]")
    expect(option.value).toBe(0)
  })

  test("builds visible message rows with selected marker", () => {
    const rows = buildVisibleMessageRows(
      [
        createMessage({ messageId: "m1", previewText: "first" }),
        createMessage({ messageId: "m2", previewText: "second" }),
      ],
      1,
      10,
    )

    expect(rows).toHaveLength(2)
    expect(rows[0].name.startsWith("  ")).toBeTrue()
    expect(rows[1].name.startsWith("> ")).toBeTrue()
  })

  test("builds a sliding window around cursor", () => {
    const messages = Array.from({ length: 30 }, (_, idx) =>
      createMessage({ messageId: `m-${idx}`, previewText: `preview ${idx}` }),
    )
    const rows = buildVisibleMessageRows(messages, 20, 8)

    expect(rows).toHaveLength(8)
    expect(rows.some((row) => row.name.includes("preview 20"))).toBeTrue()
  })

  test("renders one-line rows without newline content", () => {
    const rows = buildVisibleMessageRows([
      createMessage({ previewText: "line1\nline2\nline3" }),
    ], 0, 5)

    expect(rows[0].name.includes("\n")).toBeFalse()
  })

  test("sorts chat messages by created time ascending and descending", () => {
    const old = createMessage({ messageId: "old", createdAt: new Date("2026-01-01T00:00:00Z") })
    const newer = createMessage({ messageId: "new", createdAt: new Date("2026-01-02T00:00:00Z") })

    const asc = sortChatMessages([newer, old], "asc")
    const desc = sortChatMessages([newer, old], "desc")

    expect(asc.map((m) => m.messageId)).toEqual(["old", "new"])
    expect(desc.map((m) => m.messageId)).toEqual(["new", "old"])
  })

  test("limits rendered parts for very large messages", () => {
    const message = createMessage({
      parts: Array.from({ length: 60 }, (_, idx) => ({
        partId: `p-${idx}`,
        messageId: "m1",
        type: "text",
        text: `part ${idx}`,
      })),
    })

    const visible = getVisibleParts(message)
    expect(visible.parts).toHaveLength(40)
    expect(visible.hiddenCount).toBe(20)
  })
})
