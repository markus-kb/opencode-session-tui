import { describe, expect, test } from "bun:test"
import { formatListRowLabel, buildVisibleMessageRows } from "../../src/tui/chat-viewer"
import type { ChatMessage } from "../../src/lib/opencode-data"

function makeMsg(id: string, role: ChatMessage["role"], preview: string, time: string): ChatMessage {
  return {
    sessionId: "s",
    messageId: id,
    role,
    createdAt: new Date(`2024-01-01T${time}:00Z`),
    parts: [],
    previewText: preview,
    totalChars: preview.length,
  }
}

describe("formatListRowLabel", () => {
  test("selected row starts with > marker", () => {
    const msg = makeMsg("a", "user", "hello world", "22:33")
    const label = formatListRowLabel(msg, 0, true)
    expect(label.startsWith(">")).toBe(true)
  })

  test("unselected row starts with space marker", () => {
    const msg = makeMsg("a", "user", "hello world", "22:33")
    const label = formatListRowLabel(msg, 0, false)
    expect(label.startsWith(" ")).toBe(true)
  })

  test("number is right-aligned in 3 chars", () => {
    const msg = makeMsg("a", "assistant", "hello", "10:00")
    const label = formatListRowLabel(msg, 0, false)
    // format: " " + " " + "  1" + " " → "    1 A ..."
    // marker(1) + space(1) + num right-aligned in 3 + space(1) + ...
    expect(label).toMatch(/^.\s{3}1\s/)
  })

  test("number 42 takes 3 chars", () => {
    const msg = makeMsg("a", "user", "hi", "10:00")
    const label = formatListRowLabel(msg, 41, false)
    // " " + " " + " 42" + " " → "  42 U ..."
    expect(label).toMatch(/^.\s{2}42\s/)
  })

  test("assistant role shows A", () => {
    const msg = makeMsg("a", "assistant", "reply", "10:00")
    const label = formatListRowLabel(msg, 0, false)
    expect(label).toContain(" A ")
  })

  test("user role shows U", () => {
    const msg = makeMsg("a", "user", "question", "10:00")
    const label = formatListRowLabel(msg, 0, false)
    expect(label).toContain(" U ")
  })

  test("preview is truncated to fit pane width (≤42 chars total)", () => {
    const msg = makeMsg("a", "user", "a".repeat(100), "10:00")
    const label = formatListRowLabel(msg, 0, false)
    expect(label.length).toBeLessThanOrEqual(42)
  })

  test("short preview is not truncated", () => {
    const msg = makeMsg("a", "user", "hi", "10:00")
    const label = formatListRowLabel(msg, 0, false)
    expect(label).toContain("hi")
    expect(label).not.toContain("...")
  })
})

describe("buildVisibleMessageRows", () => {
  test("returns empty array for empty messages", () => {
    expect(buildVisibleMessageRows([], 0, 12)).toEqual([])
  })

  test("returns at most maxRows entries", () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      makeMsg(`m${i}`, "user", "text", "10:00")
    )
    const rows = buildVisibleMessageRows(msgs, 0, 12)
    expect(rows.length).toBeLessThanOrEqual(12)
  })

  test("marks the cursor row as selected", () => {
    const msgs = [
      makeMsg("a", "user", "first", "10:00"),
      makeMsg("b", "assistant", "second", "10:01"),
    ]
    const rows = buildVisibleMessageRows(msgs, 1, 12)
    const selected = rows.filter(r => r.selected)
    expect(selected.length).toBe(1)
    expect(selected[0].key).toBe("b")
  })
})
