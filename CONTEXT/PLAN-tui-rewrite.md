# TUI Rewrite Preparation Plan

This plan prepares the OpenTUI app for a fundamental rewrite without losing the behavior that currently works. The intent is to move from a monolithic `App` component toward explicit screens, scoped input handling, shared data resources, and a fast home dashboard.

## Phase 1: Stabilize Current Behavior

Freeze the current TUI behavior with regression tests before major refactoring.

- [ ] Capture startup behavior, including the initial home/help screen.
- [x] Test that the initial home screen does not load sessions or compute tokens.
- [x] Test home dismissal via Enter and Esc.
- [x] Add process-level e2e coverage for binary TUI help paths.
- [ ] Test help toggle behavior from the workspace.
- [ ] Test keyboard precedence for search, confirmations, chat viewer, chat search, and panels.
- [ ] Test project-to-session navigation.
- [ ] Test confirmation flows for destructive actions.
- [ ] Test refresh behavior and token cache invalidation.

Exit criteria: current behavior is protected by tests, especially around startup, input routing, and destructive operations.

## Phase 2: Define Target Product Model

Detailed model: `CONTEXT/TUI-TARGET-MODEL.md`

Decide what the TUI fundamentally is before rewriting its implementation.

- [x] Define the top-level app model: dashboard-first app, workspace manager, session explorer, chat search tool, or a combination behind explicit screens.
- [x] Define the screen list and ownership boundaries.
- [x] Define which actions are global, screen-local, panel-local, and overlay-local.
- [x] Define which screens are allowed to trigger expensive data loading.
- [x] Define what must remain read-only and what can mutate metadata.

Proposed target screens:

- Home dashboard
- Workspace
- Projects panel
- Sessions panel
- Chat viewer
- Chat search
- Help overlay
- Confirmation overlay
- Project selector overlay

Exit criteria: a written screen/state model exists, including navigation transitions and data-loading rules.

## Phase 3: Extract Shared Foundations

Introduce clean building blocks without changing visible behavior.

- [x] Extract `StatusBar` from `src/tui/app.tsx`.
- [x] Extract `ConfirmBar` from `src/tui/app.tsx`.
- [x] Extract `KeyChip`, `Section`, `Row`, `Bullet`, and related layout helpers.
- [x] Extract `SearchBar`.
- [x] Extract common overlay frame and pane frame components.
- [x] Move token formatting helpers out of `app.tsx` where appropriate.
- [x] Keep behavior unchanged while reducing the size of `app.tsx`.

Exit criteria: shared UI primitives live outside the root app and can be reused by new screens.

## Phase 4: Introduce Explicit Navigation State

Replace scattered booleans with one coherent app navigation model.

- [x] Replace `showHelp` with explicit typed screen state.
- [x] Replace `chatViewerOpen` and `chatSearchOpen` with explicit screen or overlay state.
- [x] Preserve current tab state as part of workspace state.
- [x] Model modal precedence explicitly instead of relying on long `if` ordering.
- [x] Define typed navigation events, such as open workspace, open help, open chat, close overlay, and quit.

Example target shape:

```ts
type Screen =
  | { name: "home" }
  | { name: "workspace"; activeTab: "projects" | "sessions"; projectFilter?: string }

type Overlay =
  | { name: "help" }
  | { name: "confirm"; id: string }
  | { name: "chatViewer"; sessionId: string }
  | { name: "chatSearch"; projectFilter?: string }
  | { name: "projectSelector"; operation: "move" | "copy" }
```

Exit criteria: screen and overlay state are explicit, typed, and easy to inspect.

## Phase 5: Separate Data From Rendering

Move provider calls and derived loading state into dedicated hooks/resources.

- [x] Introduce explicit resource-loading policy for home, workspace, and chat overlays.
- [x] Create a shared project index resource.
- [x] Create a root-level shared session index resource for global tokens and chat search.
- [x] Move panel session loading onto the shared session index resource.
- [x] Create token summary resources that can be enabled only after the workspace opens.
- [x] Create a chat session resource for message index and lazy hydration.
- [x] Create a chat search resource for scoped search.
- [x] Ensure data resources are refreshable through a single refresh pathway.
- [x] Avoid duplicate `provider.loadSessionRecords()` calls across the app.
- [x] Avoid duplicate `provider.loadProjectRecords()` calls across the app.

## Phase 6: Rebuild Input Handling

- [x] Introduce a command registry as the source of truth for keybindings.
- [x] Define all TUI keybindings as typed Command objects with scope-prefixed IDs.
- [x] Introduce key router (toCommandKey, toCommandScope, resolveCommand) with tests.
- [x] Wire App.handleGlobalKey through resolveCommand for home and global workspace keys.
- [x] Wire chat viewer, chat search, and confirm overlay keys through resolveCommand.
- [x] Wire panel handleKey through resolveCommand.
- [x] Generate home/help key reference content from the command registry.
- [x] Generate CLI usage keybinding text from the same registry where practical.
- [x] Make input precedence explicit and testable.

Example command shape:

```ts
type Command = {
  id: string
  label: string
  keys: string[]
  scope: "global" | "home" | "workspace" | "projects" | "sessions" | "chat" | "search"
}
```

Exit criteria: changing a keybinding requires editing one command definition, not render markup and input logic separately.

## Phase 7: Redesign The Home Screen

Turn the initial screen into a fast dashboard rather than a static help page.

- [x] Show storage mode and configured data source paths.
- [x] Show whether SQLite and legacy JSON stores are available.
- [x] Show that project/session/token loading is deferred until workspace entry.
- [x] Show primary actions: open workspace, projects, sessions, help, quit.
- [x] Hide global token `loading...` while loading is intentionally deferred.
- [x] Keep home render cheap: no full session scan, token aggregation, or chat indexing.

Example home content:

```txt
OpenCode Metadata Manager

Storage
Hybrid mode
SQLite: available
Legacy JSON: available

Library
Projects: deferred until workspace opens
Sessions: deferred until workspace opens
Tokens: deferred

Primary Actions
[Enter] Open workspace
[1] Projects
[2] Sessions
[?] Help
[Q] Quit
```

Exit criteria: startup feels instant and the UI clearly explains what has and has not loaded.

## Phase 8: Recompose The Workspace

Rebuild the main workspace from independent panels.

- [x] Extract `ProjectsPanel` into its own module.
- [x] Extract `SessionsPanel` into its own module.
- [x] Give each panel local selection, cursor, filtering, and refresh behavior.
- [x] Feed both panels from shared project/session resources.
- [x] Keep project-to-session navigation explicit through workspace actions.
- [x] Ensure each panel can be tested independently.

Exit criteria: the workspace is composed from isolated panels rather than embedded in the root app.

## Phase 9: Rebuild Overlays As First-Class UI

Move overlays into dedicated components with scoped state and input.

- [x] Extract help overlay.
- [x] Extract confirmation lifecycle.
- [x] Extract chat viewer overlay.
- [x] Extract chat search overlay.
- [x] Extract project selector overlay.
- [ ] Give each overlay a clear open/close lifecycle.
- [x] Remove ad hoc absolute-positioned overlay JSX from the root app.

Exit criteria: overlays are composable, predictable, and do not leak input or state into unrelated screens.

## Phase 10: Polish, Performance, And Cleanup

Finalize the architecture after the rewrite foundation is in place.

- [ ] Profile startup time.
- [ ] Profile workspace entry time.
- [ ] Profile chat search and token summary paths.
- [ ] Remove obsolete transitional state and compatibility paths.
- [ ] Update README with the new TUI model.
- [ ] Update `PROJECT-SUMMARY.md` with the new architecture.
- [ ] Run typecheck and full test suite.

Exit criteria: smaller files, clearer ownership, stable tests, faster startup, and easier feature work.

## Recommended First Milestone

Start with a preparation milestone rather than the full rewrite.

- [ ] Add regression tests around current TUI startup and keyboard behavior.
- [ ] Extract keybinding definitions into a shared command registry.
- [ ] Extract home/help rendering into separate components.
- [ ] Introduce typed screen state while keeping current visible behavior mostly unchanged.
- [ ] Hide or reword global token loading on the home screen while loading is intentionally deferred.

This creates a safe bridge from the current monolith to the future rewrite.
