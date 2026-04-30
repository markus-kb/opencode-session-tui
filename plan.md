# Active Plan: TUI Rewrite Preparation

The active workstream is preparing the OpenTUI app for a fundamental rewrite while preserving current behavior with red-green TDD and atomic commits.

Primary references:

- `CONTEXT/PLAN-tui-rewrite.md` — phased rewrite preparation checklist.
- `CONTEXT/TUI-TARGET-MODEL.md` — target product/screen/overlay/resource model.
- `PROJECT-SUMMARY.md` — current implemented architecture summary.

Current progress:

- [x] Phase 1 starter regression seam: home startup state, deferred data loading, home key behavior.
- [x] Phase 2 target model: dashboard-first app, explicit screens, overlays, ownership boundaries, loading rules.
- [x] Phase 3 starter extraction: token formatting helpers moved to `src/tui/format.ts` with tests.
- [x] Phase 3 shared UI primitives: `Section`, `Row`, `Bullet`, `Columns`, `KeyChip`, and `SearchBar` extracted to `src/tui/components.tsx`.
- [x] Phase 3 confirm bar extraction: `ConfirmBar` and `ConfirmState` moved to `src/tui/confirm-bar.tsx`.
- [x] Phase 3 status bar extraction: `StatusBar` and `NotificationLevel` moved to `src/tui/status-bar.tsx`.
- [x] Phase 3 overlay frame extraction: `OverlayFrame` added to `src/tui/components.tsx` and used by chat overlays.
- [x] Phase 4 screen state: home/workspace modeled through typed `TuiState.screen`.
- [x] Phase 4 overlay state: chat viewer/search modeled through typed `TuiState.overlay`.
- [x] Phase 4 input precedence seam: `src/tui/input-precedence.ts` makes search/confirm/overlay/home/workspace priority explicit.
- [x] Phase 4 navigation event seam: `applyNavigationEvent` centralizes typed open workspace/home/chat/search/close overlay events.
- [x] Phase 5 starter policy: screen/overlay-aware resource-loading policy added in `src/tui/resource-policy.ts`.
- [x] E2E hardening: binary TUI help paths covered by process-level tests.
- [x] Phase 5 session resource seam: root session metadata load shared by global tokens and chat search.
- [x] Phase 5 project resource seam: root project index shared by session move/copy selectors; `isProjectMetadataEnabled` policy helper.
- [x] Phase 5 panel session derivation: SessionsPanel derives filtered sessions from root allSessions; ProjectsPanel receives root allSessions for token computation.
- [x] Phase 5 token resource seam: panel token computations gated through token-resource.ts and resource policy.
- [x] Phase 5 chat session resource seam: chat viewer message index and hydration gated through `src/tui/chat-session-resource.ts`.
- [x] Phase 5 chat search resource seam: scoped chat search gated through `src/tui/chat-search-resource.ts`.
- [x] Phase 5 refresh seam: workspace resource refresh key increment moved to `src/tui/workspace-refresh.ts`.
- [x] Phase 6 starter command registry: typed Command/CommandScope model, scope-aware key lookup, home key reference generation.
- [x] Phase 6 key router: toCommandKey, toCommandScope, resolveCommand with tests.
- [x] Phase 6 overlay key routing: confirm, chat viewer, chat search keys routed through resolveCommand.
- [x] Phase 6 panel key routing: ProjectsPanel and SessionsPanel handleKey routed through resolveCommand.
- [x] Phase 6 help from registry: HelpScreen generates content from getScopedKeyReference().
- [x] Phase 6 CLI usage: TUI usage keybinding text generated from the command registry.
- [x] Phase 6 complete: input precedence covered by key-router tests.
- [x] Phase 7 home dashboard: static help screen replaced with tested storage/library/actions model and cheap source availability detection.
- [x] Phase 7 home screen extraction: dashboard view moved to `src/tui/home-screen.tsx`.
- [x] Phase 8 starter project panel seam: project panel command ids mapped through `src/tui/project-panel-commands.ts`.
- [x] Phase 8 starter session panel seam: session panel command ids mapped through `src/tui/session-panel-commands.ts`.
- [x] Phase 8 panel selection seam: shared selection helpers added in `src/tui/panel-selection.ts` and used by both panels.
- [x] Phase 8 selection pruning seam: stale selected-index pruning moved into `src/tui/panel-selection.ts`.
- [x] Phase 8 cursor seam: shared cursor clamping moved into `src/tui/panel-selection.ts`.
- [x] Phase 8 selected-record seam: current-row fallback selection moved into `src/tui/panel-selection.ts`.
- [x] Phase 8 projects panel extraction: `ProjectsPanel` moved to `src/tui/projects-panel.tsx`.
- [x] Phase 8 sessions panel extraction: `SessionsPanel` moved to `src/tui/sessions-panel.tsx`.
- [x] Phase 8 shared project feed: `ProjectsPanel` now consumes root `allProjects` instead of loading project records itself.
- [x] Phase 8 project-to-session navigation seam: project row navigation now goes through `src/tui/workspace-navigation.ts`.
- [x] Phase 8 sessions derive seam: sessions sort/search derivation moved to `src/tui/sessions-panel-derive.ts`.
- [x] Phase 8 projects input seam: project panel key-to-action routing moved to `src/tui/projects-panel-input.ts` with focused tests.
- [x] Phase 8 sessions input seam: session panel key-to-action routing moved to `src/tui/sessions-panel-input.ts` with focused tests.
- [x] Phase 8 sessions mode seam: rename/transfer mode transitions moved to `src/tui/sessions-panel-modes.ts`.
- [x] Phase 8 confirm payload seam: deletion confirm title/detail builders shared in `src/tui/confirm-payload.ts`.
- [x] Phase 8 reload execution seam: reload token invalidation + panel refresh workflow moved to `src/tui/workspace-reload-execute.ts`.
- [x] Phase 9 project selector extraction: move/copy project selector moved to `src/tui/project-selector.tsx`.
- [x] Phase 9 help screen extraction: registry-backed help screen moved to `src/tui/help-screen.tsx`.
- [x] Phase 9 chat viewer extraction: chat viewer overlay moved to `src/tui/chat-viewer.tsx`.
- [x] Phase 9 chat search extraction: chat search overlay moved to `src/tui/chat-search-overlay.tsx`.
- [x] Phase 9 confirmation lifecycle seam: confirmation request/cancel/start/finish helpers moved to `src/tui/confirm-lifecycle.ts`.
- [x] Phase 9 chat overlay lifecycle seam: chat viewer/search open-close reset state moved to `src/tui/chat-overlay-lifecycle.ts`.
- [x] Phase 9 chat search navigation seam: result handoff to session/message cursor moved to `src/tui/chat-search-navigation.ts`.
- [x] Phase 9 overlay host seam: root overlay composition moved to `src/tui/overlay-host.tsx`.
- [x] Phase 9 project selector lifecycle seam: open-close selector state moved to `src/tui/project-selector-lifecycle.ts`.
- [x] Phase 10 profiling baseline seam: timing sample summarization moved to `src/tui/perf-baseline.ts` with dedicated regression tests.

Phase 10 baseline samples (local machine, 5 runs each, proxy paths):

- `startup (tui --help)`: min 128.33ms, max 158.91ms, avg 139.10ms, median 136.57ms.
- `workspace entry` (targeted app-state transition test): min 81.41ms, max 106.23ms, avg 91.23ms, median 89.85ms.
- `chat search path` (targeted chat-search resource test): min 77.30ms, max 103.22ms, avg 85.49ms, median 82.74ms.
- `token summary path` (targeted token-resource formatting test): min 81.75ms, max 99.85ms, avg 87.58ms, median 85.62ms.
- Caveat: these are stable CI-friendly proxy timings, not full interactive renderer benchmarks.

- [x] Phase 10 documentation sync: rewrite plan/README/PROJECT-SUMMARY updated to match landed seams and current profiling baseline status; stale unchecked items cleared.

Safety rules for this workstream:

- Do not modify real OpenCode sessions during tests.
- Use temp paths, fixtures, or pure state helpers for write/read regression tests.
- Keep each step covered by a red-green test and committed atomically.
- Keep this file, `CONTEXT/PLAN-tui-rewrite.md`, `CONTEXT/TUI-TARGET-MODEL.md`, `README.md`, and `PROJECT-SUMMARY.md` current as architecture changes land.

---

# SQLite Support Status (Current)

SQLite support is implemented and active in this fork. The older detailed backlog has been retired from this file because it no longer reflects the codebase state.

Implemented and verified:

- [x] SQLite data layer exists in `src/lib/opencode-data-sqlite.ts` (reads, writes, search, token summaries).
- [x] Provider abstraction exists in `src/lib/opencode-data-provider.ts` with `jsonl`, `sqlite`, and `hybrid` backends.
- [x] CLI global flags are wired and documented (`--experimental-sqlite`, `--db`, `--sqlite-strict`, `--force-write`).
- [x] CLI commands use provider wiring (`projects`, `sessions`, `chat`, `tokens`).
- [x] Schema validation and graceful warning behavior are implemented (`validateSchema`, malformed JSON handling, strict-mode behavior).
- [x] SQLite fixture assets and tooling exist (`tests/fixtures/test.db`, `tests/fixtures/create-test-db.ts`, `tests/fixtures/README.md`).
- [x] SQLite benchmark script and benchmark document exist (`scripts/benchmark-sqlite.ts`, `CONTEXT/BENCHMARK-sqlite.md`).
- [x] SQLite-focused test coverage exists in `tests/lib/opencode-data-sqlite.test.ts` and CLI integration coverage in `tests/cli/**`.

Current tracking location:

- `CONTEXT/PLAN-sqlite-support.md` remains the detailed design/reference document.
- This `plan.md` now tracks active rewrite-preparation work, with SQLite listed here as completed capability.

Success criteria status:

- [x] `opencode-manager projects list --experimental-sqlite` is supported.
- [x] `opencode-manager sessions list --experimental-sqlite` is supported.
- [x] `opencode-manager chat list --session X --experimental-sqlite` is supported.
- [x] Existing tests pass on current branch.
- [x] SQLite tests pass on current branch.
- [x] Default non-forced behavior remains backward-compatible via provider backend selection.
