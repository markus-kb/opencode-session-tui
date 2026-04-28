> **Fork notice:** This repository is a fork of [shuv1337/oc-manager](https://github.com/shuv1337/oc-manager). The primary goal of this fork is to maintain compatibility with the current OpenCode SQLite schema (post-Feb 2025 migration) and to ensure the test suite runs on Windows. All credit for the original design, TUI, and CLI goes to the upstream author.

# OpenCode Metadata Manager

Terminal UI for inspecting, filtering, and pruning OpenCode metadata stored on disk. The app is written in TypeScript, runs on Bun, and renders with [`@opentui/react`](https://github.com/sst/opentui).

## Install

Install this fork globally from the git repository to get the `opencode-manager` command on your PATH:

```bash
bun add -g git+https://github.com/markus-kb/oc-manager-fork.git
```

Then run it from any directory:

```bash
opencode-manager --help
opencode-manager --root ~/.local/share/opencode
```

If you only want to try it locally from the source checkout, use `bunx` or `bun run` instead of a global install:

```bash
bunx opencode-manager --help
bun run src/bin/opencode-manager.ts --help
```

## What this fork changes

OpenCode migrated its storage layer from JSONL flat-files to a SQLite database (Drizzle ORM schema) in early 2025. The upstream repo predates that migration. This fork updates the SQLite backend to read the current schema and uses hybrid mode by default when both `opencode.db` and legacy JSON sessions are present:

- **Schema alignment** — `SessionRow`, `MessageRow`, `PartRow` interfaces updated to match the real Drizzle columns (`time_created`/`time_updated`; session has no JSON `data` blob; message/part carry a `data` JSON blob).
- **Hybrid auto-detect** — `createProvider()` now reads both current SQLite sessions and legacy JSON sessions when both stores exist. SQLite-only and JSONL-only stores still work. `--experimental-sqlite` remains available to force SQLite-only mode.
- **Startup performance** — TUI startup no longer scans sessions while the initial help screen is open. Session lists are metadata-only: they read session rows/files but do not parse messages, parts, or large diff payloads until chat, token, or search features need them.
- **Write operations** — `updateSessionTitle`, `moveSession`, `copySession` rewritten for the column-based schema; `copySession` correctly rewrites `sessionID`/`messageID`/`id` fields inside copied message and part JSON blobs.
- **All 13 part types** — `PartType` union expanded to cover `reasoning`, `step-start`, `step-finish`, `snapshot`, `patch`, `agent`, `retry`, `compaction`, `file` in addition to the original `text`, `subtask`, `tool`.
- **Windows compatibility** — `closeIfOwned()` runs `PRAGMA wal_checkpoint(TRUNCATE)` before closing to release WAL handles; test `afterEach` hooks use a retry loop for `EBUSY`/`EPERM`; `chmod`-dependent CLI tests are skipped on Windows; path assertions normalised for cross-platform separators.
- **`expandUserPath` fix** — Unix absolute paths stored in the database (e.g. `/tmp/foo`) are no longer mangled to Windows paths when the tool runs on Windows.

## Storage modes

- **Hybrid (default TUI/auto mode)** — merges `~/.local/share/opencode/opencode.db` sessions with legacy `storage/session/<projectId>/*.json` sessions. Duplicate session IDs prefer SQLite because that is the current OpenCode source of truth.
- **SQLite-only** — pass `--experimental-sqlite` or `--db <path>` when you only want the current OpenCode database.
- **JSONL-only** — pass `--root <path>` through CLI commands that explicitly use the legacy backend, or use a store without `opencode.db`.

The session list is intentionally lightweight in all modes. Message JSON, part JSON, and large patch/diff payloads are loaded lazily for chat viewing, token summaries, and chat search.

## Installation
```bash
# Clone the repo and install deps
git clone https://github.com/markus-kb/oc-manager-fork.git
cd oc-manager-fork
bun install

```

## Credits
Original project by [shuv1337](https://github.com/shuv1337) — [shuv1337/oc-manager](https://github.com/shuv1337/oc-manager). This fork adapts the tool for the current OpenCode SQLite schema and adds Windows compatibility.

## License
MIT © OpenCode contributors. See [`LICENSE`](./LICENSE).
