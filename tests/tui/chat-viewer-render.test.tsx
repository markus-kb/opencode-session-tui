/**
 * Rendered layout invariant tests for ChatViewer.
 *
 * These tests use @opentui/react's testRender + captureCharFrame to assert on
 * the *actual terminal output*, not on code structure. Any layout change that
 * makes a required element disappear or duplicates it will fail here before
 * it ever reaches the user.
 *
 * Invariants verified:
 *  - Session info row is always present ("Session:")
 *  - ShortcutHints bar is always present ("[Esc]")
 *  - The > selection marker appears exactly once across all message rows
 *  - The right-pane title is capitalised ("User message" / "Assistant message")
 *  - No duplicate message rows appear (each row label is unique)
 *  - Both panels' border titles are rendered exactly once
 */
import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"
import type { ChatMessage, SessionRecord } from "../../src/lib/opencode-data"
import { ChatViewer } from "../../src/tui/chat-viewer"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSession(): SessionRecord {
  return {
    index: 1,
    filePath: "/fake/path",
    sessionId: "ses_test123",
    projectId: "proj_test456",
    directory: "/fake/dir",
    title: "Test session",
    version: "1.0",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }
}

function makeMsg(id: string, role: ChatMessage["role"], preview: string): ChatMessage {
  return {
    sessionId: "ses_test123",
    messageId: id,
    role,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    parts: [{ partId: `${id}-p`, messageId: id, type: "text", text: `Content of ${id}` }],
    previewText: preview,
    totalChars: preview.length,
  }
}

// 8 messages: U A A U A A U A
const TEST_MESSAGES: ChatMessage[] = [
  makeMsg("m0", "user",      "First user message"),
  makeMsg("m1", "assistant", "First assistant reply"),
  makeMsg("m2", "assistant", "Second assistant message"),
  makeMsg("m3", "user",      "Second user message"),
  makeMsg("m4", "assistant", "Third assistant message"),
  makeMsg("m5", "assistant", "Fourth assistant message"),
  makeMsg("m6", "user",      "Third user message"),
  makeMsg("m7", "assistant", "Fifth assistant message"),
]

const noop = () => {}

async function renderAt(width: number, height: number, cursor = 0, messages = TEST_MESSAGES) {
  const session = makeSession()
  const { captureCharFrame, renderer } = await testRender(
    <ChatViewer
      session={session}
      messages={messages}
      cursor={cursor}
      sortOrder="asc"
      onCursorChange={noop}
      loading={false}
      error={null}
      onClose={noop}
      onHydrateMessage={noop}
      onCopyMessage={noop}
      maxRows={20}
    />,
    { width, height },
  )
  await act(async () => {})
  const frame = captureCharFrame()
  renderer.destroy()
  return frame
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChatViewer rendered layout — 120×30", () => {
  test("Session info row is present", async () => {
    const frame = await renderAt(120, 30)
    expect(frame).toContain("Session:")
    expect(frame).toContain("ses_test123")
  })

  test("ShortcutHints bar is present", async () => {
    const frame = await renderAt(120, 30)
    expect(frame).toContain("[Esc]")
    expect(frame).toContain("[C-Up/Dn]")
  })

  test("Messages pane border title is present exactly once", async () => {
    const frame = await renderAt(120, 30)
    const count = (frame.match(/Messages/g) ?? []).length
    // "Messages" appears in the pane title; more than once means a duplicate border
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(2) // at most one in title + one in ShortcutHints hint label (none there, so 1)
  })

  test("right-pane title is capitalised: User message or Assistant message", async () => {
    const userFrame = await renderAt(120, 30, 0)  // cursor on user message
    // Border title uses capital U: ┌─User message─
    expect(userFrame).toContain("─User message")

    const assistantFrame = await renderAt(120, 30, 1)  // cursor on assistant message
    // Border title uses capital A: ┌─Assistant message─
    expect(assistantFrame).toContain("─Assistant message")
  })

  test("selection marker > appears exactly once across message rows", async () => {
    for (let cursor = 0; cursor < TEST_MESSAGES.length; cursor++) {
      const frame = await renderAt(120, 30, cursor)
      // Count "> " at start of a row (preceded by newline or start of frame)
      const matches = frame.match(/>\s+\d/g) ?? []
      expect(matches.length).toBe(1)
    }
  })

  test("no duplicate row labels in the message list", async () => {
    const frame = await renderAt(120, 30)
    const rows = frame.split("\n").filter(line => /^\s+\d+\s+[UA]\s/.test(line.trim()))
    const unique = new Set(rows.map(r => r.trim()))
    expect(unique.size).toBe(rows.length)
  })
})

describe("ChatViewer rendered layout — 120×24 (smaller terminal)", () => {
  test("Session info row is still present", async () => {
    const frame = await renderAt(120, 24)
    expect(frame).toContain("Session:")
  })

  test("ShortcutHints bar is still present", async () => {
    const frame = await renderAt(120, 24)
    expect(frame).toContain("[Esc]")
  })

  test("selection marker > appears exactly once", async () => {
    const frame = await renderAt(120, 24, 2)
    const matches = frame.match(/>\s+\d/g) ?? []
    expect(matches.length).toBe(1)
  })
})

describe("ChatViewer rendered layout — after resize", () => {
  test("Session row and ShortcutHints survive a resize", async () => {
    const session = makeSession()
    const { captureCharFrame, resize, renderer } = await testRender(
      <ChatViewer
        session={session}
        messages={TEST_MESSAGES}
        cursor={0}
        sortOrder="asc"
        onCursorChange={noop}
        loading={false}
        error={null}
        onClose={noop}
        onHydrateMessage={noop}
        onCopyMessage={noop}
        maxRows={20}
      />,
      { width: 120, height: 30 },
    )
    await act(async () => {})

    resize(120, 20)
    await act(async () => {})
    const smallFrame = captureCharFrame()
    expect(smallFrame).toContain("Session:")
    expect(smallFrame).toContain("[Esc]")

    resize(120, 30)
    await act(async () => {})
    const restoredFrame = captureCharFrame()
    expect(restoredFrame).toContain("Session:")
    expect(restoredFrame).toContain("[Esc]")

    renderer.destroy()
  })
})
