> **Fork notice:** This repository is a fork of [shuv1337/oc-manager](https://github.com/shuv1337/oc-manager). The primary goal of this fork is to maintain compatibility with the current OpenCode SQLite schema (post-Feb 2025 migration) and to ensure the test suite runs on Windows. All credit for the original design, TUI, and CLI goes to the upstream author.

# OpenCode Metadata Manager

Terminal UI for inspecting, filtering, and pruning OpenCode metadata stored on disk. The app is written in TypeScript, runs on Bun, and renders with [`@opentui/react`](https://github.com/sst/opentui).

## What this fork changes

OpenCode migrated its storage layer from JSONL flat-files to a SQLite database (Drizzle ORM schema) in early 2025. The upstream repo predates that migration. This fork updates the SQLite backend to read the current schema and makes SQLite the default when `opencode.db` is detected:

- **Schema alignment** — `SessionRow`, `MessageRow`, `PartRow` interfaces updated to match the real Drizzle columns (`time_created`/`time_updated`; session has no JSON `data` blob; message/part carry a `data` JSON blob).
- **Auto-detect backend** — `createProvider()` now picks SQLite automatically when `opencode.db` exists in the store root; JSONL remains the fallback for older installations. `--experimental-sqlite` is no longer required for normal use.
- **Write operations** — `updateSessionTitle`, `moveSession`, `copySession` rewritten for the column-based schema; `copySession` correctly rewrites `sessionID`/`messageID`/`id` fields inside copied message and part JSON blobs.
- **All 13 part types** — `PartType` union expanded to cover `reasoning`, `step-start`, `step-finish`, `snapshot`, `patch`, `agent`, `retry`, `compaction`, `file` in addition to the original `text`, `subtask`, `tool`.
- **Windows compatibility** — `closeIfOwned()` runs `PRAGMA wal_checkpoint(TRUNCATE)` before closing to release WAL handles; test `afterEach` hooks use a retry loop for `EBUSY`/`EPERM`; `chmod`-dependent CLI tests are skipped on Windows; path assertions normalised for cross-platform separators.
- **`expandUserPath` fix** — Unix absolute paths stored in the database (e.g. `/tmp/foo`) are no longer mangled to Windows paths when the tool runs on Windows.

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
