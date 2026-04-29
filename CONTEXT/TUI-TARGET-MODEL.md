# TUI Target Product Model

This document defines the target product model for the fundamental TUI rewrite. It is intentionally product- and architecture-level, not a component implementation plan.

## Product Identity

The TUI should be a fast, local-first OpenCode metadata workspace.

It has four jobs:

- Give a trustworthy overview of available OpenCode metadata stores.
- Let the user inspect and organize projects and sessions safely.
- Let the user inspect chat history without mutating chat content.
- Make expensive reads explicit, deferred, and interruptible where possible.

It should not feel like a static help page wrapped around a data browser. It should launch into a cheap dashboard, then enter a richer workspace only when the user asks for it.

## Design Principles

- Home is cheap and honest: no full session scan, token aggregation, or chat indexing on initial render.
- Screens own workflows; overlays own temporary interruption states.
- Input scope follows visible state: active overlay first, active screen second, active panel third.
- Keybindings are commands, not scattered `if` branches.
- Data resources are shared by screens and panels; provider calls should not be duplicated in render components.
- Metadata writes are explicit, confirmed when destructive, and routed through the provider layer.
- Chat content remains read-only unless a future requirement explicitly changes that policy.

## Top-Level App Shape

The app should have one visible screen and zero or one blocking overlay at a time.

```ts
type AppModel = {
  screen: Screen
  overlay: Overlay | null
  status: StatusMessage | null
  storage: StorageStatus
}

type Screen =
  | HomeScreen
  | WorkspaceScreen

type Overlay =
  | HelpOverlay
  | ConfirmOverlay
  | ChatViewerOverlay
  | ChatSearchOverlay
  | ProjectSelectorOverlay
```

This deliberately separates primary navigation from temporary UI. Help, confirmation, chat viewing, chat search, and project selection should not be encoded as unrelated booleans on the root component.

## Screens

### Home Dashboard

Purpose: launch instantly and explain what the app can do before expensive data loading starts.

Owns:

- Storage mode display.
- Detected source summary.
- Deferred loading explanation.
- Primary action list.
- Entry points into workspace tabs.

Does not own:

- Session list data.
- Project list data.
- Token summaries.
- Chat search data.
- Destructive actions.

Allowed data reads:

- Cheap filesystem existence checks already needed to resolve backend mode.
- No session metadata scans.
- No token aggregation.
- No chat message or part reads.

Primary actions:

- Enter: open workspace on Projects.
- 1: open workspace on Projects.
- 2: open workspace on Sessions.
- ?: open help overlay.
- Q or Ctrl+C: quit.

### Workspace Screen

Purpose: the main metadata management environment.

Owns:

- Active tab: Projects or Sessions.
- Optional project filter for Sessions.
- Shared project/session resources.
- Workspace-level search state.
- Refresh orchestration.

Does not own:

- Confirmation internals.
- Chat viewer internals.
- Chat search internals.
- Project selector internals.

Allowed data reads:

- Project metadata list.
- Session metadata list.
- Token summaries only after workspace entry.
- Chat index only when chat viewer/search asks for it.

Primary actions:

- Tab: switch active tab.
- 1: focus Projects.
- 2: focus Sessions.
- /: start workspace search.
- X: clear workspace search.
- R: refresh visible resources.
- ?: open help overlay.
- Q or Ctrl+C: quit.

## Panels

### Projects Panel

Purpose: inspect projects and navigate to their sessions.

Owns:

- Project cursor.
- Project selection.
- Missing-only filter.
- Project-specific details display.

Consumes:

- Shared project index.
- Shared session index for derived token/project metrics only when enabled.

Writes:

- Delete project metadata after confirmation.

Actions:

- Up/Down: move cursor.
- Space: toggle selection.
- A: select all visible.
- M: toggle missing-only.
- D: request delete confirmation.
- Enter: open Sessions tab with project filter.
- Esc: clear selection.

### Sessions Panel

Purpose: inspect, organize, and navigate sessions.

Owns:

- Session cursor.
- Session selection.
- Sort mode.
- Rename draft state.
- Current project filter display.

Consumes:

- Shared session index.
- Shared project index for move/copy target selection.
- Token summaries for selected/current session when enabled.

Writes:

- Delete session metadata after confirmation.
- Rename session title.
- Move session metadata.
- Copy session metadata.

Actions:

- Up/Down: move cursor.
- Space: toggle selection.
- A: select all visible.
- S: toggle sort.
- C: clear project filter.
- D: request delete confirmation.
- Y: copy session ID.
- V: open chat viewer overlay.
- F: open chat search overlay scoped to visible sessions or current project filter.
- Shift+R: enter rename mode.
- M: open project selector overlay for move.
- P: open project selector overlay for copy.
- Enter: show/copy details according to final UX decision.
- Esc: clear selection or cancel local edit mode.

## Overlays

### Help Overlay

Purpose: show keybindings and concepts for the current screen.

Owns:

- No persistent data.
- Current help scope selection if needed.

Actions:

- Esc, ?, or H: close.
- Q or Ctrl+C: quit only if global quit remains allowed through overlays.

Source of content:

- Command registry, not hand-maintained duplicate markup.

### Confirmation Overlay

Purpose: block dangerous or consequential actions until confirmed.

Owns:

- Title.
- Preview details.
- Confirm action callback or command descriptor.
- Busy state.

Actions:

- Y or Enter: confirm.
- N or Esc: cancel.

Rules:

- Destructive metadata writes must use this overlay.
- Routine state changes should not create comments or other audit noise.

### Chat Viewer Overlay

Purpose: inspect one session's chat history read-only.

Owns:

- Message cursor.
- Hydrated message cache.
- Current message details view.

Consumes:

- Chat session resource for message index.
- Lazy message-part hydration resource.

Writes:

- Clipboard only.
- No session/message/part mutation.

Actions:

- Up/Down: move message cursor.
- PgUp/PgDn or Ctrl+U/Ctrl+D: jump.
- Home/End: first/last message.
- Y: copy current message.
- Esc: close.

### Chat Search Overlay

Purpose: search chat content across a scoped session set.

Owns:

- Query draft.
- Search cursor.
- Search result list.

Consumes:

- Session scope from workspace.
- Chat search resource.

Writes:

- None.

Actions:

- Text input: edit query.
- Enter: run search or open selected result.
- Up/Down: move result cursor.
- Esc: close.

### Project Selector Overlay

Purpose: choose a target project for session move/copy.

Owns:

- Target project cursor.
- Operation mode: move or copy.

Consumes:

- Shared project index.
- Selected sessions from Sessions panel.

Writes:

- Move/copy session metadata through provider after selection.

Actions:

- Up/Down: move project cursor.
- Enter: execute operation.
- Esc: cancel.

## Command Scopes

Commands should be registered by scope and reused for input handling, help rendering, and CLI usage where practical.

```ts
type CommandScope =
  | "global"
  | "home"
  | "workspace"
  | "projects"
  | "sessions"
  | "help"
  | "confirm"
  | "chatViewer"
  | "chatSearch"
  | "projectSelector"

type Command = {
  id: string
  label: string
  keys: string[]
  scope: CommandScope
  destructive?: boolean
  readonly?: boolean
}
```

Input resolution order:

- Active blocking overlay.
- Active screen.
- Active panel inside workspace.
- Global fallback.

This order should be covered by tests before replacing the current key router.

## Data Loading Rules

Data loading should be explicit and screen-aware.

```ts
type ResourcePolicy = {
  projects: "deferred" | "metadata"
  sessions: "deferred" | "metadata"
  tokens: "deferred" | "summary"
  chat: "deferred" | "index" | "hydrated-message"
}
```

Target policies:

- Home: projects deferred, sessions deferred, tokens deferred, chat deferred.
- Workspace Projects: projects metadata, sessions metadata only if needed for visible project metrics, tokens summary only after metadata load.
- Workspace Sessions: sessions metadata, projects metadata for target selection, tokens summary only after metadata load.
- Chat Viewer: chat index for one session, hydrated parts for current message only.
- Chat Search: chat search over explicitly scoped sessions.

## Mutability Policy

Read-only by default:

- Chat messages.
- Chat parts.
- Token summaries.
- Search results.
- Home/dashboard source detection.

Writable with confirmation:

- Project metadata deletion.
- Session metadata deletion.

Writable without destructive confirmation, but with clear status feedback:

- Session title rename.
- Session move.
- Session copy.

Provider-level safety rules:

- UI must not mutate files or databases directly.
- Every write goes through `DataProvider`.
- Tests for writes must use fixtures or temp paths only.
- Real OpenCode session stores must not be modified by automated tests.

## Ownership Boundaries

Root app owns:

- Provider creation and disposal.
- Renderer lifecycle.
- Screen and overlay state.
- Status messages.

Screens own:

- Workflow-level state.
- Resource enablement.
- Delegation to panels and overlays.

Panels own:

- Cursor and selection state.
- Local filters and local edit modes.
- Requests for overlay actions.

Resources own:

- Provider reads.
- Loading/error state.
- Cache invalidation.
- Refresh behavior.

Overlays own:

- Temporary modal state.
- Scoped input handling while open.

## Migration Implications

The rewrite should happen by replacing internals behind stable behavior, not by rewriting everything at once.

Recommended sequence:

- Keep current `App` behavior protected by Phase 1 tests.
- Extract command definitions next.
- Extract reusable UI primitives.
- Introduce typed navigation state.
- Move provider reads into resources.
- Recompose workspace and overlays.

## Open Decisions

- Whether Enter on a session should show inline details, open chat, or keep the current status-message behavior.
- Whether global quit should work while confirmation overlays are open.
- Whether chat search should search all known sessions by default or only visible/filtered sessions.
- Whether project token summaries should appear by default or only on demand.
- Whether move/copy should require confirmation for multi-session operations.
