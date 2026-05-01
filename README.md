# OpenCode Session Metadata Manager

Terminal UI for inspecting, filtering, and pruning OpenCode metadata stored on disk. The app is written in TypeScript, runs on Bun, and renders with [`@opentui/react`](https://github.com/sst/opentui).

## Install

Install this fork globally from the git repository to get the `opencode-manager` command on your PATH:

```bash
bun add -g git+https://github.com/markus-kb/opencode-session-tui.git
```

Then run it from any directory:

```bash
opencode-manager --help
opencode-manager --root ~/.local/share/opencode
```

If you only want to try it locally from the source checkout, use `bunx` or `bun run` instead of a global install:

```bash
bunx opencode-manager --help
bun run manager -- --help
```

### Windows-friendly local launch

For local development on Windows, use the package scripts instead of calling source files directly:

```bash
bun run start
```

You can also double-click `opencode-manager.bat` from this repository root to launch the app in a Windows terminal.

Additional options:

```bash
bun run start -- --db "C:\\Users\\<you>\\.local\\share\\opencode\\opencode.db"
bun run manager -- projects list --format table
```

## What this repository changes

OpenCode migrated its storage layer from JSONL flat-files to a SQLite database (Drizzle ORM schema) in early 2025. The upstream repo predates that migration. This repository updates the SQLite backend to read the current schema and uses hybrid mode by default when both `opencode.db` and legacy JSON sessions are present:

- **Schema alignment** — `SessionRow`, `MessageRow`, `PartRow` interfaces updated to match the real Drizzle columns (`time_created`/`time_updated`; session has no JSON `data` blob; message/part carry a `data` JSON blob).
- **Hybrid auto-detect** — `createProvider()` now reads both current SQLite sessions and legacy JSON sessions when both stores exist. SQLite-only and JSONL-only stores still work. `--experimental-sqlite` remains available to force SQLite-only mode.
- **Startup performance** — TUI startup no longer scans sessions while the initial help screen is open. Session lists are metadata-only: they read session rows/files but do not parse messages, parts, or large diff payloads until chat, token, or search features need them.
- **TUI rewrite preparation** — the OpenTUI app is being incrementally prepared for a fundamental rewrite behind regression tests. Current preparation includes typed navigation events, explicit input precedence, first-class overlay host/lifecycle seams, shared resource seams (session/project/token/chat), and independent panel input/derive seams.
- **Write operations** — `updateSessionTitle`, `moveSession`, `copySession` rewritten for the column-based schema; `copySession` correctly rewrites `sessionID`/`messageID`/`id` fields inside copied message and part JSON blobs.
- **All 13 part types** — `PartType` union expanded to cover `reasoning`, `step-start`, `step-finish`, `snapshot`, `patch`, `agent`, `retry`, `compaction`, `file` in addition to the original `text`, `subtask`, `tool`.
- **Windows compatibility** — `closeIfOwned()` runs `PRAGMA wal_checkpoint(TRUNCATE)` before closing to release WAL handles; test `afterEach` hooks use a retry loop for `EBUSY`/`EPERM`; `chmod`-dependent CLI tests are skipped on Windows; path assertions normalised for cross-platform separators.
- **`expandUserPath` fix** — Unix absolute paths stored in the database (e.g. `/tmp/foo`) are no longer mangled to Windows paths when the tool runs on Windows.

## Storage modes

- **Hybrid (default TUI/auto mode)** — merges `~/.local/share/opencode/opencode.db` sessions with legacy `storage/session/<projectId>/*.json` sessions. Duplicate session IDs prefer SQLite because that is the current OpenCode source of truth.
- **SQLite-only** — pass `--experimental-sqlite` or `--db <path>` when you only want the current OpenCode database.
- **JSONL-only** — pass `--root <path>` through CLI commands that explicitly use the legacy backend, or use a store without `opencode.db`.

The session list is intentionally lightweight in all modes. Message JSON, part JSON, and large patch/diff payloads are loaded lazily for chat viewing, token summaries, and chat search.

## Architecture and change docs

The current TUI still renders through `src/tui/app.tsx`. Consolidated architecture and change documentation now lives in:

- `docs/CHANGES.md`

The target architecture keeps OpenTUI, but moves from a monolithic root component toward explicit screens, first-class overlays, shared data resources, scoped input handling, and a fast home dashboard that does not trigger expensive metadata scans.

Regression coverage includes pure TUI state/resource-policy/session-resource tests and process-level e2e checks for `opencode-manager --help`, `opencode-manager --db <path> --help`, and `opencode-manager tui --help` so users can discover TUI storage modes without launching the interactive renderer.

Key TUI seams now live in dedicated modules under `src/tui/`, including:

- `app-state.ts` (typed state + navigation events)
- `input-precedence.ts` (input layer priority)
- `overlay-host.tsx` and `chat-overlay-lifecycle.ts` (overlay composition/lifecycle)
- `session-resource.ts`, `project-resource.ts`, `token-resource.ts`, `chat-session-resource.ts`, `chat-search-resource.ts` (resource access seams)
- `projects-panel-input.ts`, `sessions-panel-input.ts`, `sessions-panel-derive.ts`, `sessions-panel-modes.ts` (panel behavior seams)

Current Phase 10 status:

- Baseline timing helper is in place (`src/tui/perf-baseline.ts`) with regression tests.
- Typecheck and full test suite are green.
- Interactive-renderer profiling is still tracked as a final follow-up because headless help/test paths are stable proxies, not full interactive render benchmarks.

## Project Summary

### Overview

- Purpose: inspect, filter, and manage OpenCode metadata.
- Interfaces: interactive TUI (`@opentui/react`) and scriptable CLI (Commander).
- Storage backends: JSONL, SQLite, and hybrid provider mode.

### Entry points

- `src/bin/opencode-manager.ts`: routes to CLI or TUI.
- CLI mode: `projects`, `sessions`, `chat`, `tokens` commands.
- TUI mode: default launch or explicit `tui` subcommand.

### Architecture snapshot

- CLI (`src/cli/`): global option parsing, command handlers, output formatters, error/resolver/backup utilities.
- TUI (`src/tui/`): typed app state and navigation, command routing, shared data resources, panel seams, overlay/lifecycle seams.
- Shared libs (`src/lib/`): JSONL storage, SQLite storage, provider abstraction, search and clipboard helpers.

### Storage behavior

- Default root: `~/.local/share/opencode`.
- Default SQLite path: `~/.local/share/opencode/opencode.db`.
- Hybrid mode merges SQLite + JSON sessions and prefers SQLite on duplicate IDs.
- Session listing is metadata-first; message/part payloads load lazily for chat/search/tokens.

### Key capabilities

- Projects: list/filter/search/select/delete.
- Sessions: list/filter/search/sort/select/rename/move/copy/delete.
- Chat: list/show/search with hydration and optional clipboard copy.
- Tokens: session/project/global summaries.

### Runtime notes

- Global options include `--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`.
- Storage/backend options include `--experimental-sqlite`, `--db`, `--sqlite-strict`, `--force-write`.
- Exit codes: `0` success, `1` internal error, `2` usage/validation, `3` not found, `4` file operation error.

### Testing posture

- Comprehensive CLI/data/TUI seam coverage.
- SQLite fixtures under `tests/fixtures/`.
- Full-suite and typecheck expected green on every change.

## Installation
```bash
# Clone the repo and install deps
git clone https://github.com/markus-kb/opencode-session-tui.git
cd opencode-session-tui
bun install
```

## Credits
Original project by [shuv1337](https://github.com/shuv1337) — [shuv1337/oc-manager](https://github.com/shuv1337/oc-manager).

This repository has diverged from the original fork lineage while preserving explicit attribution. The current maintainers adapted the tool for the modern OpenCode SQLite schema, hybrid storage support, Windows compatibility, and TUI architecture hardening.

## License
MIT © OpenCode contributors. See [`LICENSE`](./LICENSE).
