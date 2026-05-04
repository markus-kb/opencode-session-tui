# Project Plan: Session Chat History Viewer + Global Fuzzy Search (TUI)

Date: 2025-12-20
Updated: 2025-12-20 (post-review revision)

## Problem Statement / Context
OpenCode Metadata Manager is a Bun + TypeScript + `@opentui/react` TUI that currently:

- Lists OpenCode projects and sessions stored under a local metadata root.
- Supports selection, delete, rename, move/copy sessions, and a **per-tab** search bar.
- Reads token telemetry from message JSON files but **does not display the chat content**.

Requested additions:

1. **View session chat history** (the actual messages/turns for a session).
2. **Global fuzzy search** across:
   - all sessions across all projects, OR
   - all sessions within a project (when a project filter is active).

This plan is written to be executable step-by-step without re-establishing context.

## Goals
- Provide an in-TUI way to inspect a session's conversation (chat history).
- Upgrade search from tokenized substring matching to **fuzzy**, with sensible ranking.
- Maintain performance on large stores (many projects/sessions/messages) and avoid UI freezes.

## Non-Goals (for initial delivery)
- No network calls; no external indexing service (e.g., Elasticsearch/Meilisearch server).
- No modification of OpenCode's on-disk schema.
- No "semantic" search (embeddings). Only text-based fuzzy/full-text.

## Current State (Baseline)
### Storage and data loading
- Storage root default: `src/lib/opencode-data.ts` (`DEFAULT_ROOT` → `~/.local/share/opencode`).
- Projects loaded from: `storage/project/*.json` and `storage/sessions/*.json`.
- Sessions loaded from: `storage/session/<projectId>/*.json`.
- Message metadata files:
  - Primary: `storage/message/<sessionId>/*.json`
  - Legacy fallback: `storage/session/message/<sessionId>/*.json`
- **Message content (parts)** (see Observed Schema below):
  - Primary: `storage/part/<messageId>/*.json`
  - Legacy fallback: `storage/session/part/<messageId>/*.json`

Relevant internal files:
- `src/opencode-tui.tsx` (TUI UI, keyboard handling, list panels)
- `src/lib/opencode-data.ts` (filesystem reads/writes, token aggregation)
- `src/bin/opencode-manager.ts` (CLI entry)
- `package.json` (deps/scripts)

### Search behavior today
- Projects and Sessions search currently uses:
  - `searchQuery.trim().toLowerCase().split(/\s+/)` tokens
  - `includes()` matching across fields
- Search scope is **active tab** only (inactive tab receives an empty query).
- Search input mode (current behavior in `src/opencode-tui.tsx`):
  - `/` enters search input; keystrokes update `searchQuery` immediately (live filtering while typing)
  - `Enter` exits search input (leaves the current query applied)
  - `Esc` exits search input and clears the query; `X` clears the query when not in search mode
- Sessions can be filtered to a project via "jump to sessions" or filter state.

### Existing token display
- `src/opencode-tui.tsx:1013-1027` already displays token breakdown in session details
- Reuse existing `TokenSummary` and `TokenBreakdown` types from `src/lib/opencode-data.ts:10-28`

---

## Observed Schema (from Milestone 0 Discovery)

> This section documents the actual on-disk schema discovered by examining real OpenCode data stores.

### Message Metadata Files (`storage/message/<sessionId>/<messageId>.json`)

Message JSON files contain **metadata only**, not content. Example structure:

**User message:**
```json
{
  "id": "msg_af11f2e4c001TJFzsuSl5RiPKw",
  "sessionID": "ses_50ee0d1b5ffeL3zD9yL90sqQwW",
  "role": "user",
  "time": { "created": 1764981943887 },
  "agent": "build",
  "model": { "providerID": "anthropic", "modelID": "claude-opus-4-5" },
  "sentEstimate": 0,
  "contextEstimate": 0
}
```

**Assistant message:**
```json
{
  "id": "msg_af11f2e53001DPGOE7vawTttNg",
  "sessionID": "ses_50ee0d1b5ffeL3zD9yL90sqQwW",
  "role": "assistant",
  "time": { "created": 1764981943891 },
  "parentID": "msg_af11f2e4c001TJFzsuSl5RiPKw",
  "modelID": "claude-opus-4-5",
  "providerID": "anthropic",
  "mode": "build",
  "path": { "cwd": "/home/user/project", "root": "/home/user/project" },
  "cost": 0,
  "tokens": {
    "input": 0, "output": 0, "reasoning": 0,
    "cache": { "read": 0, "write": 0 }
  },
  "sentEstimate": 0
}
```

**Key observations:**
- No `content` field in message metadata
- `role` is always present: `"user"` or `"assistant"`
- `time.created` provides chronological ordering (milliseconds)
- `tokens` only present on assistant messages
- `parentID` links assistant responses to user messages

### Part Files (`storage/part/<messageId>/<partId>.json`)

**Content is stored in separate "part" files**, organized by message ID. Each message can have multiple parts.

**Part types observed:**

1. **`text` part** — Direct text content:
```json
{
  "id": "prt_af11f2e5d0018T3N3IriE1yla0",
  "sessionID": "ses_50ee0d1a5ffew1hGzxt7Ymy0Z6",
  "messageID": "msg_af11f2e5c001nn5GX4SDa4AuRa",
  "type": "text",
  "text": "The actual message content goes here..."
}
```

2. **`subtask` part** — Task/agent delegation:
```json
{
  "id": "prt_af11f2e4f001DIAJO7QO6G68U2",
  "sessionID": "ses_50ee0d1b5ffeL3zD9yL90sqQwW",
  "messageID": "msg_af11f2e4c001TJFzsuSl5RiPKw",
  "type": "subtask",
  "prompt": "The task prompt/description...",
  "description": "Short description",
  "agent": "build"
}
```

3. **`tool` part** — Tool invocation and results:
```json
{
  "id": "prt_af11f2e56001ZvqYEwxQRJO2lu",
  "sessionID": "ses_50ee0d1b5ffeL3zD9yL90sqQwW",
  "messageID": "msg_af11f2e53001DPGOE7vawTttNg",
  "type": "tool",
  "callID": "01KBRHYBJPMHQNT93VCNEG651Q",
  "tool": "task",
  "state": {
    "status": "running",
    "input": { "prompt": "...", "description": "...", "subagent_type": "build" },
    "time": { "start": 1764981943894 }
  }
}
```

**Key observations:**
- Parts directory (primary): `storage/part/<messageId>/` (keyed by message ID, not session ID)
- Parts directory (legacy fallback in older layouts): `storage/session/part/<messageId>/`
- Part filename: `<partId>.json`
- Part type determines content extraction:
  - `text` → use `.text` field directly
  - `subtask` → use `.prompt` field (or `.description` for preview)
  - `tool` → use `.state.input` for invocation, `.state.output` for results
- Multiple parts per message are common (e.g., text + tool call + tool result)
- Part ordering: prefer explicit sequence/time fields when present; otherwise stable-sort by filename (deterministic, not guaranteed chronological)

### Content Extraction Rules

| Part Type | Primary Content Field | Fallback |
|-----------|----------------------|----------|
| `text` | `.text` | — |
| `subtask` | `.prompt` | `.description` |
| `tool` | `.state.output` (when present; stringify safely) | `.state.input.prompt` or `[tool:<name>]` |
| Unknown | Safe JSON preview of whole part | `[unknown part type]` |

---

## Proposed UX / Interaction Design
### 1) Session chat history viewer
Add a "chat viewer" overlay/modal from the Sessions view:

- Trigger key: **`V`** (View chat)
- Overlay includes:
  - header with session title/id + project id + "READ-ONLY" indicator
  - scrollable message list (role + timestamp + preview; preview may start as "[loading…]")
  - a detail pane showing full content of selected message (hydrates parts on demand)
  - footer: key hints (`Esc` close, `Enter` expand, `Y` copy, etc.)
  - loading indicators for both "index loading" and per-message part hydration

Keyboard behavior:
- `V`: open chat viewer for currently highlighted session
- `Esc`: close viewer and cancel in-flight loads (takes precedence over "clear selection")
- `Up/Down`: move message cursor
- `PgUp/PgDn` (or `Ctrl+U` / `Ctrl+D`): faster scroll (10 messages)
- `Enter`: toggle "expanded" view for the current message (show all parts)
- `Y`: copy selected message text to clipboard
- `Home/End`: jump to first/last message
- (Modal) While viewer is open, global shortcuts like `/`, `Tab`, `?`, and `R` are disabled to avoid conflicting modes

Design constraints:
- `@opentui/react` requires all textual content inside `<text>` nodes; existing helpers already guard whitespace children.
- Large messages (>10KB) should be truncated with "[... truncated, X chars total]"
- Tool parts should show tool name and status, not full input/output by default

### 2) Global fuzzy search across sessions
Upgrade Sessions searching to fuzzy matching with ranking:

- Search scope:
  - Fuzzy search operates on **currently loaded** sessions (respects existing `projectFilter`)
  - If `projectFilter` is set: search within that project's sessions only
  - If no filter: search across all loaded sessions
- Interaction: results update as you type in `/` search mode; `Enter` exits search input (query remains applied).
- Fields (initial): `title`, `sessionId`, `directory`, `projectId`.
- Result ordering:
  - primary: best fuzzy score
  - secondary: recency (by current sort mode: updated/created)

Optional UX improvements:
- show a "top N results" cap for very broad matches
- show match highlights if the chosen fuzzy library supports it

---

## Data Model & Technical Specifications
> There is no HTTP API in this project. "API" here refers to internal TypeScript interfaces/functions.

### Part Model (NEW)

```ts
export type PartType = "text" | "subtask" | "tool" | "unknown";

export interface ChatPart {
  partId: string;
  messageId: string;
  type: PartType;
  text: string;           // extracted human-readable content
  toolName?: string;      // for tool parts
  toolStatus?: string;    // "running" | "completed" | "error"
  raw?: unknown;          // preserved for debugging (optional in production)
}
```

### Message (chat history) model (REVISED)

```ts
export type ChatRole = "user" | "assistant" | "unknown";

export interface ChatMessage {
  sessionId: string;
  messageId: string;        // from message metadata file
  role: ChatRole;
  createdAt: Date | null;   // from message.time.created
  parentId?: string;        // for threading (assistant → user)
  tokens?: TokenBreakdown;  // only on assistant messages (reuse existing type)

  // Parts are loaded lazily for performance.
  parts: ChatPart[] | null;

  // Computed for display
  previewText: string;       // placeholder until parts load; then first N chars of combined parts
  totalChars: number | null; // null until parts load
}
```

### Content Extraction Implementation

```ts
function toDisplayText(value: unknown, maxChars = 10_000): string {
  let full = "";
  if (value == null) {
    full = "";
  } else if (typeof value === "string") {
    full = value;
  } else {
    try {
      full = JSON.stringify(value, null, 2);
    } catch {
      full = String(value);
    }
  }

  if (full.length <= maxChars) {
    return full;
  }
  return `${full.slice(0, maxChars)}\n[… truncated, ${full.length} chars total]`;
}

function extractPartContent(part: unknown): { text: string; toolName?: string; toolStatus?: string } {
  const p = part as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type : "unknown";

  switch (type) {
    case "text":
      return { text: toDisplayText(p.text) };

    case "subtask":
      return { text: toDisplayText(p.prompt ?? p.description ?? "") };

    case "tool": {
      const state = (p.state ?? {}) as Record<string, unknown>;
      const toolName = typeof p.tool === "string" ? p.tool : "unknown";
      const status = typeof state.status === "string" ? state.status : "unknown";

      // Prefer output when present; otherwise show a prompt-like input summary.
      if ("output" in state) {
        return { text: toDisplayText(state.output), toolName, toolStatus: status };
      }

      const input = (state.input ?? {}) as Record<string, unknown>;
      const prompt = input.prompt ?? `[tool:${toolName}]`;
      return { text: toDisplayText(prompt), toolName, toolStatus: status };
    }

    default:
      // Unknown part type: attempt a safe JSON preview, then fall back to a label.
      return { text: toDisplayText(part) || `[${type} part]` };
  }
}
```

### Session search index model
Since datasets are local and likely moderate, keep it in-memory:

```ts
export interface SessionSearchDoc {
  sessionId: string;
  projectId: string;
  title: string;
  directory: string;
  version: string;
  createdAt: number; // ms
  updatedAt: number; // ms
}
```

Build docs from `SessionRecord[]` (already loaded).

---

## External Sources / Libraries (for fuzzy search)
We will pick one library based on performance + simplicity.

### Options comparison
| Option | Type | Pros | Cons | Best for |
|---|---|---|---|---|
| `Fuse.js` | fuzzy matching on object fields | Flexible weighting, widely used, supports match metadata | Heavier, needs tuning | Weighted multi-field fuzzy ranking |
| `fast-fuzzy` | fast fuzzy search (strings/objects) | Very small API, fast, returns score + match data | Less configurable than Fuse for multi-field weighting | Simple ranked fuzzy matching |
| `MiniSearch` | in-memory full-text engine w/ fuzzy/prefix | Full-text indexing, fuzzy per term, boosting | Heavier conceptually; requires indexing lifecycle | Searching *message content* across many docs |

Primary references (Git URLs):
- Fuse.js: https://github.com/krisk/Fuse
- fast-fuzzy: https://github.com/EthanRutherford/fast-fuzzy
- MiniSearch: https://github.com/lucaong/minisearch

### Decision (recommended)
Start with **fast-fuzzy** for sessions-level fuzzy matching:
- Minimal dependency surface.
- Easy to rank and cap results.
- Suitable for interactive TUI filtering on each keystroke / apply.

If we later add **full-text search across message bodies**, consider **MiniSearch** as a phase 2 engine.

---

## Integration Points (Internal)
### Data layer additions (`src/lib/opencode-data.ts`)
Add functions (optimized for a fast "open viewer" path + lazy part loading):

- Export existing `loadSessionMessagePaths(sessionId, root)` (currently internal at `src/lib/opencode-data.ts:569`).

- `loadMessagePartPaths(messageId: string, root: string): Promise<string[] | null>` — NEW
  - Primary: `storage/part/<messageId>/*.json`
  - Legacy fallback (older layouts): `storage/session/part/<messageId>/*.json`
  - Returns `null` when neither directory exists.

- `loadSessionChatIndex(sessionId: string, root?: string): Promise<ChatMessage[]>` — NEW/REVISED
  - Reads message *metadata only* via `loadSessionMessagePaths`.
  - Sorts by `time.created` with a stable fallback (filename) for ties/missing timestamps.
  - Does **not** load part content by default (keeps the TUI responsive).
  - Initializes `previewText` as a placeholder (e.g., `"[loading…]"`) until parts are loaded.

- `loadMessageParts(messageId: string, root: string): Promise<ChatPart[]>` — NEW
  - Uses `loadMessagePartPaths` (primary + legacy).
  - Extracts human-readable content with safe stringification + truncation.
  - Orders parts deterministically (prefer explicit sequence/time fields when present; otherwise filename).
  - Returns `[]` when the parts directory exists but no readable parts are present.

- (Optional convenience) `hydrateChatMessageParts(message: ChatMessage, root: string): Promise<ChatMessage>`
  - Loads parts and fills `previewText` / `totalChars`.

**Error handling contract**
- "Missing directory" returns `null`/`[]` as documented above.
- Unexpected I/O failures should surface to the caller so the UI can show a real error (`chatError`) instead of silently showing "No messages".

### UI layer additions (`src/opencode-tui.tsx`)
Add state + components:
- `ChatViewer` overlay component
  - renders above panels similar to `HelpScreen` / `ProjectSelector`
  - shows session header + "READ-ONLY" label + load/progress state

- New keyboard routing (critical for modal correctness):
  - `handleGlobalKey` checks `isChatViewerOpen` first and routes viewer keys (`Esc`, `Up/Down`, `PgUp/PgDn`, `Home/End`, `Enter`, `Y`).
  - While viewer is open, disable tab switching and search activation to avoid conflicting global modes.

### Dependency updates (`package.json`)
- Add `fast-fuzzy` to `dependencies` and use `Searcher` for live filtering (avoids rebuilding the trie per keystroke).

---

## Implementation Plan (Ordered, With Milestones)

### Milestone 0 — Discovery / schema confirmation ✅ COMPLETE

Goal: confirm how OpenCode stores message content for chat history.

- [x] Collect 2–3 real message JSON samples from a local OpenCode store under `storage/message/<sessionId>/`.
- [x] Identify fields for role, timestamps, and content payload shape.
- [x] Identify whether message content is inline or references `storage/part/...`.
- [x] Document findings in this plan (see "Observed Schema" section above).

**Findings:**
- Message metadata in `storage/message/` does NOT contain content.
- Content is stored in per-message part files:
  - Primary: `storage/part/<messageId>/<partId>.json`
  - Legacy fallback (older layouts): `storage/session/part/<messageId>/<partId>.json`
- Three part types observed: `text`, `subtask`, `tool` (unknown types possible; handle defensively).

---

### Milestone 1 — Add chat history data loading primitives (REVISED) ✅ COMPLETE
Goal: enable fast metadata load + lazy part hydration without UI freezes.

- [x] In `src/lib/opencode-data.ts`, define types:
  - [x] `PartType`, `ChatPart`, `ChatRole`, `ChatMessage` (as updated above: `parts: ChatPart[] | null`, `tokens?: TokenBreakdown`)

- [x] Export `loadSessionMessagePaths(sessionId, root)` (currently internal).

- [x] Implement `loadMessagePartPaths(messageId, root)` (primary + legacy fallback):
  - [x] Primary directory: `storage/part/<messageId>/`
  - [x] Legacy fallback: `storage/session/part/<messageId>/`
  - [x] Return `null` if neither exists; otherwise return `*.json` file paths.

- [x] Implement `loadSessionChatIndex(sessionId, root)` (metadata only):
  - [x] Resolve message JSON paths using `loadSessionMessagePaths` (primary + legacy message layouts).
  - [x] Parse message metadata into `ChatMessage` stubs:
    - [x] Extract: `id`, `role`, `time.created`, `tokens` (assistant only), `parentID`
    - [x] Initialize: `parts: null`, `previewText: "[loading…]"`, `totalChars: null`
  - [x] Sort by `createdAt` with a stable fallback (filename) for ties/missing timestamps.
  - [x] Return `[]` when the message directory is missing.

- [x] Implement `loadMessageParts(messageId, root)`:
  - [x] Use `loadMessagePartPaths` (primary + legacy).
  - [x] Parse each part JSON file and extract a `ChatPart` using `extractPartContent`.
  - [x] Skip malformed part JSON (log warning), but continue loading remaining parts.
  - [x] Return parts in deterministic order (prefer explicit sequence/time fields when present; otherwise filename).

- [x] Implement `hydrateChatMessageParts(message, root)` (recommended):
  - [x] Load parts and set `message.parts`.
  - [x] Compute `previewText` (first 200 chars of concatenated part text; use `"[no content]"` if empty).
  - [x] Compute `totalChars`.

- [ ] (Optional) Add cancellation support (e.g., `AbortSignal`) for long part-loading operations so `Esc` can cancel background work.

**Validation criteria**
- [x] `loadSessionChatIndex()` returns quickly and does not load parts.
- [x] `loadMessageParts()` works for both `storage/part/…` and legacy `storage/session/part/…` layouts.
- [x] Part extraction yields readable text for `text`, `subtask`, and `tool` parts (no `[object Object]`).
- [x] Malformed part JSON does not crash the loader.

---

### Milestone 2 — Add ChatViewer overlay UI (GLOBAL OVERLAY) ✅ COMPLETE
Goal: display messages without global key conflicts and without blocking the UI.

- [x] In `src/opencode-tui.tsx`, add `ChatViewer` overlay component:
  - [x] Header: session title/id/project + "READ-ONLY" label + message count + load/progress indicator
  - [x] Left pane: message list using `<select>`:
    - [x] Label format: `[role] timestamp - previewText` (preview may start as `"[loading…]"`)
    - [x] Use existing `PALETTE` colors: user=accent, assistant=primary
  - [x] Right pane: message detail:
    - [x] If `message.parts === null`, show "Loading…" and trigger hydration for that message
    - [x] Otherwise render parts; for tool parts show `[tool: name] status` header
    - [x] Wrap text, respect terminal width
  - [x] Footer: `Esc close | ↑↓ navigate | PgUp/PgDn jump | Enter expand | Y copy`

- [x] Store viewer state at the **App (global)** level (not inside `SessionsPanel`):
  - [x] `isChatViewerOpen`, `chatSession`, `chatMessages`, `chatCursor`
  - [x] `chatLoadingIndex`, `chatError`, `chatLoadProgress`
  - [x] `partsCacheByMessageId` (memoize hydrated parts so navigation is instant)
  - [ ] (Optional) `abortController` for canceling in-flight work

- [x] Add key handling in `handleGlobalKey` when viewer is open:
  - [x] `Esc` → close viewer (and cancel in-flight loads)
  - [x] `Up/Down`, `PgUp/PgDn`, `Home/End` → move message cursor
  - [x] `Y` → copy selected message combined text to clipboard
  - [ ] `Enter` → toggle expanded view (or force hydration of selected message)
  - [x] While viewer is open, ignore `/`, `Tab`, and other global shortcuts to avoid conflicting modes.

- [x] Open viewer flow (`V` from Sessions):
  - [x] Open viewer immediately in "loading index" state.
  - [x] Call `loadSessionChatIndex(sessionId)`.
  - [x] Once metadata is loaded, render the list.
  - [x] Hydrate parts on demand for the selected message (and optionally prefetch nearby messages with a small concurrency limit).

**Validation criteria**
- [x] Pressing `V` on a session opens the chat viewer quickly (metadata-first).
- [x] Viewer captures keys reliably: `Esc` closes viewer and does not clear session selection.
- [x] Tabs/search cannot be toggled underneath the open viewer.
- [x] Empty sessions show "No messages" and do not crash.

---

### Milestone 3 — Replace sessions substring search with fuzzy search ✅ COMPLETE
Goal: fuzzy matching on currently loaded sessions.

- [x] Add `fast-fuzzy` dependency to `package.json`:
  ```bash
  bun add fast-fuzzy
  ```

- [x] In `src/opencode-tui.tsx` SessionsPanel (search updates live while typing, so avoid rebuilding the trie per keystroke):
  - [x] Import `Searcher` from `fast-fuzzy`.
  - [x] Build fuzzy candidates in a `useMemo` that depends on `records`:
    - `{ session: SessionRecord, searchText: string, createdMs: number, updatedMs: number }`
    - `searchText` should concatenate: `title`, `sessionId`, `directory`, `projectId` (and normalize whitespace).
  - [x] Build `const searcher = useMemo(() => new Searcher(candidates, { keySelector: c => c.searchText }), [candidates])`.
  - [x] In `visibleRecords` useMemo:
    - If `searchQuery` is empty, return the current sorted list (no behavior change).
    - If `searchQuery` is non-empty:
      - Call `searcher.search(searchQuery, { returnMatchData: true })`.
      - Map results via `match.item.session` (match objects contain `{ item, score, match... }`).
      - Sort primarily by `score` desc; tie-break by current `sortMode` timestamp; then `sessionId` for stability.

- [x] Update Sessions header to show search mode:
  - [x] Change from `Search: <query>` to `Search: <query> (fuzzy)` when query active

- [x] Consider result limiting:
  - [x] If >500 results, only show top 200 with "... and X more"

**Validation criteria**
- [x] Typos like "auth calbak" still find "Auth callback handling".
- [x] Partial matches work: "ses_50" finds sessions starting with that ID.
- [x] Empty query shows all sessions (current behavior preserved).
- [x] Results are stable (same query → same order).

---

### Milestone 4 — Help/Docs updates ✅ COMPLETE
Goal: keep UX discoverable.

- [x] Update Help screen in `src/opencode-tui.tsx` (around line 1146, Sessions section):
  - [x] Add: `<Bullet><KeyChip k="V" /><text> — View chat history</text></Bullet>`
  - [x] Add subsection or note about viewer keys

- [x] Update `printUsage()` function (around line 1487):
  - [x] Add `V               View chat history for selected session` under Sessions section
  - [x] Add note about viewer navigation keys

- [x] Update `README.md` Features list:
  - [x] Add "View session chat history with full conversation context"
  - [x] Add "Fuzzy search across session titles and metadata"

**Validation criteria**
- [x] `bun run tui -- --help` shows `V` key binding.
- [x] Help screen (`?`) shows chat viewer keys.
- [x] README accurately describes new features.

---

### Milestone 5 (Optional) — Global search across message content
Goal: search within chat histories across sessions.

This is not required by the prompt, but is a natural extension once chat is viewable.

- [ ] Choose an indexing strategy:
  - [ ] Option A: `MiniSearch` full-text index for `{ sessionId, projectId, messageText }`
  - [ ] Option B: On-demand grep-like scan (slower but no index maintenance)
  
- [ ] Add a global search mode:
  - [ ] Trigger: `Ctrl+F` or `Ctrl+K`
  - [ ] Searches across all message content (text parts only)
  - [ ] Returns list of matches: `{ sessionId, messageId, snippet, score }`
  
- [ ] From a search result:
  - [ ] Jump to session
  - [ ] Open ChatViewer
  - [ ] Scroll to matching message

**Validation criteria**
- [ ] Querying a keyword present only in assistant responses returns the correct sessions.
- [ ] Large stores (1000+ sessions) complete search within 5 seconds.

---

## Risks / Edge Cases

| Risk | Mitigation |
|------|------------|
| Message/part schema varies across OpenCode versions | Defensive parsing; unknown types render a safe JSON preview + placeholder label |
| Legacy layouts store parts under `storage/session/part/<messageId>/` | Add explicit legacy fallback in `loadMessagePartPaths` |
| Very large messages/tool outputs (>100KB) cause TUI freeze | Metadata-first viewer open; lazy hydrate parts; truncate previews and large serialized values with "[… truncated]" |
| Sessions with 500+ messages slow to hydrate previews | Hydrate selected message on demand; optionally prefetch nearby messages with a small concurrency limit; show progress + allow cancel |
| Part directories missing | Treat as empty content and show "[no content available]" |
| Malformed JSON in parts/messages | Skip malformed files with a warning; continue loading remaining data |
| Global key conflicts while viewer open (`/`, `Tab`, `?`) | Route viewer keys in `handleGlobalKey` before other global modes; disable search/tab switching while viewer is open |
| `M` key conflict (Projects=filter, Sessions=move) | No change needed; keys are panel-specific |

---

## Performance Plan

### Message Loading
- **Lazy loading**: Only load chat when user presses `V` on a session.
- **Metadata-first**: load message index (metadata) first and render immediately.
- **Lazy hydration**: load parts for the selected message on demand; optionally prefetch nearby messages with a small concurrency limit.
- **Progress indication**: show separate states for "index loading" vs "parts loading".
- **Cancellation**: allow `Esc` to abort in-flight loads and close viewer.
- **Caching**: cache hydrated parts by `messageId` for the active session (invalidate on reload).

### Content Display
- **Preview truncation**: First 200 characters per message in list view
- **Full text on demand**: Only render selected message's full content
- **Part limiting**: Show first 10 parts by default, "Show all X parts" button for more
- **Text wrapping**: Respect terminal width, avoid horizontal scrolling

### Fuzzy Search
- **Live filtering while typing**: Search updates per keystroke in search mode; use `fast-fuzzy` `Searcher` to avoid rebuilding the index each render.
- **Result limit**: Cap at 200 results for very broad queries (and/or tune `threshold`).
- **Precomputed fields**: Build normalized `searchText` once when sessions load/refresh.

### Memory
- **Part content**: Don't store `.raw` in production (only for debugging)
- **Message limit**: Consider capping at 1000 messages per session with "Load more" option

---

## Testing / Validation Strategy
This repo currently has typechecking but no explicit test framework.

- [ ] Add/extend type-level checks by running `bun run typecheck`.

- [ ] Manual QA checklist:
  - [ ] Open TUI with a root containing multiple projects
  - [ ] Sessions view: search fuzzy for known title + with typos
  - [ ] Filter to a project and confirm search scope restricts
  - [ ] Open ChatViewer for sessions with messages
  - [ ] Verify user messages show their prompt content
  - [ ] Verify assistant messages show response + tool calls
  - [ ] Open ChatViewer for sessions without messages (should show "No messages")
  - [ ] Open ChatViewer for sessions with missing parts directory
  - [ ] Confirm `Esc` closes viewer, doesn't clear selection
  - [ ] While viewer is open, confirm `/` and `Tab` do not activate search or switch tabs
  - [ ] Confirm `Up/Down/PgUp/PgDn` navigation works in viewer
  - [ ] Confirm `Y` copies message content
  - [ ] Verify loading indicator shows during large session load

- [ ] Edge case testing:
  - [ ] Session with 100+ messages
  - [ ] Message with 10+ parts (tool-heavy conversation)
  - [ ] Message with only tool parts (no text)
  - [ ] Part with very long content (>10KB)
  - [ ] Malformed part JSON file

---

## Deliverables
- Chat history viewer overlay in Sessions view (read-only, with part content).
- Sessions search updated to fuzzy ranking.
- Updated help screen and CLI usage.
- Updated README with new features.

---

## Appendix: Command snippets (for implementers)

```bash
# Run the TUI
bun run tui -- --root ~/.local/share/opencode

# Typecheck
bun run typecheck

# Add fuzzy search dependency
bun add fast-fuzzy

# Explore message structure (for debugging)
ls ~/.local/share/opencode/storage/message/ | head -5
ls ~/.local/share/opencode/storage/part/ | head -5
ls ~/.local/share/opencode/storage/session/part/ | head -5  # legacy layout (if present)

# View a specific message's parts (primary + legacy)
MESSAGE_ID="msg_example"
ls ~/.local/share/opencode/storage/part/$MESSAGE_ID/ || true
ls ~/.local/share/opencode/storage/session/part/$MESSAGE_ID/ || true
cat ~/.local/share/opencode/storage/part/$MESSAGE_ID/*.json 2>/dev/null | jq '.type, .text[:100]'
cat ~/.local/share/opencode/storage/session/part/$MESSAGE_ID/*.json 2>/dev/null | jq '.type, .text[:100]'
```

---

## Codebase Reference Map

| Component | File | Line(s) | Notes |
|-----------|------|---------|-------|
| Token types | `src/lib/opencode-data.ts` | 10-28 | Reuse `TokenBreakdown` |
| Message path loading | `src/lib/opencode-data.ts` | 569-597 | `loadSessionMessagePaths()` - export this |
| Part path loading (NEW) | `src/lib/opencode-data.ts` | near 569 | Add primary+legacy part resolver (`storage/part` + `storage/session/part`) |
| Session loading | `src/lib/opencode-data.ts` | 201-264 | Pattern for directory iteration |
| JSON reading | `src/lib/opencode-data.ts` | 106-113 | `readJsonFile()` helper |
| App state | `src/opencode-tui.tsx` | ~1212+ | Store ChatViewer overlay state here |
| Global key handling | `src/opencode-tui.tsx` | ~1284+ | Route ChatViewer keys in `handleGlobalKey` |
| Help screen | `src/opencode-tui.tsx` | 1084-1210 | Add new keys to Sessions section |
| CLI usage | `src/opencode-tui.tsx` | 1487-1519 | Update with new keys |
| PALETTE colors | `src/opencode-tui.tsx` | 83-91 | Use for consistent styling |
| Clipboard helper | `src/opencode-tui.tsx` | 133-143 | `copyToClipboard()` - reuse |
