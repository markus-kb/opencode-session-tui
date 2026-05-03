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

  test("preview portion is truncated to at most 26 chars (ends with ...)", () => {
    const msg = makeMsg("a", "user", "a".repeat(100), "10:00")
    const label = formatListRowLabel(msg, 0, false)
    // Extract preview: everything after the fixed 13-char prefix (marker + num + role + time)
    // Just verify the label ends with "..." and isn't unboundedly long
    expect(label.endsWith("...")).toBe(true)
    // The preview portion (last segment after final space) should be ≤26 chars
    const previewPart = label.split(" ").pop() ?? ""
    expect(previewPart.length).toBeLessThanOrEqual(26)
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

  test("invariant: exactly one row is selected for any valid cursor", () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      makeMsg(`m${i}`, i % 2 === 0 ? "user" : "assistant", `text ${i}`, "10:00")
    )
    for (let cursor = 0; cursor < msgs.length; cursor++) {
      const rows = buildVisibleMessageRows(msgs, cursor, 8)
      const selectedCount = rows.filter(r => r.selected).length
      expect(selectedCount).toBe(1)
    }
  })

  test("invariant: all row keys are unique within a single call", () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      makeMsg(`m${i}`, "user", `text ${i}`, "10:00")
    )
    const rows = buildVisibleMessageRows(msgs, 10, 12)
    const keys = rows.map(r => r.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  test("invariant: selected row name starts with '>' and unselected rows start with ' '", () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      makeMsg(`m${i}`, "user", `text ${i}`, "10:00")
    )
    const rows = buildVisibleMessageRows(msgs, 2, 10)
    for (const row of rows) {
      if (row.selected) {
        expect(row.name[0]).toBe(">")
      } else {
        expect(row.name[0]).toBe(" ")
      }
    }
  })

  test("cursor out-of-bounds (negative) clamps to first row", () => {
    const msgs = [makeMsg("a", "user", "t", "10:00"), makeMsg("b", "user", "t", "10:00")]
    const rows = buildVisibleMessageRows(msgs, -5, 10)
    expect(rows[0].selected).toBe(true)
  })

  test("cursor out-of-bounds (too large) clamps to last row", () => {
    const msgs = [makeMsg("a", "user", "t", "10:00"), makeMsg("b", "user", "t", "10:00")]
    const rows = buildVisibleMessageRows(msgs, 999, 10)
    expect(rows[rows.length - 1].selected).toBe(true)
  })
})

describe("formatListRowLabel — preview truncation invariant", () => {
  test("long preview is truncated and ends with ...", () => {
    const msg = makeMsg("b", "assistant", "a".repeat(100), "10:00")
    const label = formatListRowLabel(msg, 0, false)
    expect(label.endsWith("...")).toBe(true)
  })

  test("preview portion never exceeds 26 chars", () => {
    const cases: Array<[string, ChatMessage["role"], string]> = [
      ["a", "user", "short"],
      ["b", "assistant", "a".repeat(100)],
      ["c", "user", ""],
      ["d", "assistant", "   \n  "],
    ]
    for (const [id, role, preview] of cases) {
      const msg = makeMsg(id, role, preview, "10:00")
      const label = formatListRowLabel(msg, 0, false)
      const previewPart = label.split(" ").pop() ?? ""
      expect(previewPart.length).toBeLessThanOrEqual(26)
    }
  })
})
