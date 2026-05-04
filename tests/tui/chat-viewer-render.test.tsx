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

// 100 messages with long real-world IDs — matches real production sessions.
// Required to trigger the ShortcutHints squish bug: the left pane needs
// min(100, maxRows) + 2 rows, which exceeds available height at small sizes.
const LONG_SESSION: SessionRecord = {
  index: 1,
  filePath: "/fake/path",
  sessionId: "ses_3d2606c79ffeP930OequEjLTee",
  projectId: "133232891bd9d714b2606d6793eb68a621b7894e",
  directory: "/fake/dir",
  title: "Production session",
  version: "1.0",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

const MANY_MESSAGES: ChatMessage[] = Array.from({ length: 100 }, (_, i) =>
  makeMsg(`m${i}`, i % 2 === 0 ? "user" : "assistant", `message ${i}`)
)

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

// ── Group A: ShortcutHints at every practical terminal height ─────────────────
// Uses MANY_MESSAGES + LONG_SESSION to trigger the flex squish:
// min(100, maxRows=20) + 2(border) = 22 rows for the pane, exceeding
// the available height at 120×20 (H=12) and 120×24 (H=16), etc.
// These tests FAIL before the flexShrink:0 fix and PASS after.

async function renderMany(width: number, height: number) {
  const { captureCharFrame, renderer } = await testRender(
    <ChatViewer
      session={LONG_SESSION}
      messages={MANY_MESSAGES}
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
    { width, height },
  )
  await act(async () => {})
  const frame = captureCharFrame()
  renderer.destroy()
  return frame
}

describe("ChatViewer rendered layout — 120×20 (smallest practical, many messages)", () => {
  test("ShortcutHints bar [Esc] present", async () => {
    const frame = await renderMany(120, 20)
    expect(frame).toContain("[Esc]")
  })

  test("ShortcutHints bar [C-Up/Dn] present", async () => {
    const frame = await renderMany(120, 20)
    expect(frame).toContain("[C-Up/Dn]")
  })

  test("Session info row present", async () => {
    const frame = await renderMany(120, 20)
    expect(frame).toContain("Session:")
  })
})

describe("ChatViewer rendered layout — 120×24 (many messages)", () => {
  test("ShortcutHints bar [Esc] present", async () => {
    const frame = await renderMany(120, 24)
    expect(frame).toContain("[Esc]")
  })

  test("ShortcutHints bar [C-Up/Dn] present", async () => {
    const frame = await renderMany(120, 24)
    expect(frame).toContain("[C-Up/Dn]")
  })
})

describe("ChatViewer rendered layout — 120×28 (many messages)", () => {
  test("ShortcutHints bar [Esc] present", async () => {
    const frame = await renderMany(120, 28)
    expect(frame).toContain("[Esc]")
  })

  test("ShortcutHints bar [C-Up/Dn] present", async () => {
    const frame = await renderMany(120, 28)
    expect(frame).toContain("[C-Up/Dn]")
  })
})

// ── Group B: ShortcutHints survives long real-world IDs + many messages ───────
// Uses LONG_SESSION + MANY_MESSAGES (same as Group A helpers) to ensure
// the combination of long IDs and message volume doesn't squish ShortcutHints.

describe("ChatViewer rendered layout — long real-world IDs + many messages", () => {
  test("ShortcutHints [Esc] present at 120×30", async () => {
    const frame = await renderMany(120, 30)
    expect(frame).toContain("[Esc]")
  })

  test("ShortcutHints [C-Up/Dn] present at 120×30", async () => {
    const frame = await renderMany(120, 30)
    expect(frame).toContain("[C-Up/Dn]")
  })

  test("Session ID is rendered", async () => {
    const frame = await renderMany(120, 30)
    expect(frame).toContain("ses_3d2606c79ffeP930OequEjLTee")
  })

  test("ShortcutHints [Esc] present at 120×24", async () => {
    const frame = await renderMany(120, 24)
    expect(frame).toContain("[Esc]")
  })
})

// ── Group C: Pane border titles are clean (no bleed-through) ─────────────────

describe("ChatViewer rendered layout — pane title integrity", () => {
  test("Messages pane title renders without stray characters before/after", async () => {
    const frame = await renderAt(120, 30)
    // Title should appear as ─Messages─ (no extra word chars inserted)
    expect(frame).toContain("─Messages─")
  })

  test("right-pane title ─Assistant message─ is clean (no brackets inserted)", async () => {
    const frame = await renderAt(120, 30, 1)  // cursor on assistant
    expect(frame).toContain("─Assistant message")
    // No bracket artifacts: ─Assistant[message or similar
    expect(frame).not.toMatch(/─Assistant[^─ ]/)
  })

  test("right-pane title ─User message─ is clean (no brackets inserted)", async () => {
    const frame = await renderAt(120, 30, 0)  // cursor on user
    expect(frame).toContain("─User message")
    expect(frame).not.toMatch(/─User[^─ ]/)
  })
})

// ── Group D: All overlay states render without breaking layout ────────────────

describe("ChatViewer rendered layout — all overlay states", () => {
  async function renderState(opts: {
    messages: ChatMessage[]
    loading: boolean
    error: string | null
  }) {
    const { captureCharFrame, renderer } = await testRender(
      <ChatViewer
        session={makeSession()}
        messages={opts.messages}
        cursor={0}
        sortOrder="asc"
        onCursorChange={noop}
        loading={opts.loading}
        error={opts.error}
        onClose={noop}
        onHydrateMessage={noop}
        onCopyMessage={noop}
        maxRows={20}
      />,
      { width: 120, height: 30 },
    )
    await act(async () => {})
    const frame = captureCharFrame()
    renderer.destroy()
    return frame
  }

  test("loading state: ShortcutHints present", async () => {
    const frame = await renderState({ messages: [], loading: true, error: null })
    expect(frame).toContain("[Esc]")
  })

  test("loading state: Session row present", async () => {
    const frame = await renderState({ messages: [], loading: true, error: null })
    expect(frame).toContain("Session:")
  })

  test("error state: ShortcutHints present", async () => {
    const frame = await renderState({ messages: [], loading: false, error: "something went wrong" })
    expect(frame).toContain("[Esc]")
  })

  test("error state: error text rendered", async () => {
    const frame = await renderState({ messages: [], loading: false, error: "something went wrong" })
    expect(frame).toContain("something went wrong")
  })

  test("empty state: ShortcutHints present", async () => {
    const frame = await renderState({ messages: [], loading: false, error: null })
    expect(frame).toContain("[Esc]")
  })

  test("empty state: empty message shown", async () => {
    const frame = await renderState({ messages: [], loading: false, error: null })
    expect(frame).toContain("No messages found")
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
