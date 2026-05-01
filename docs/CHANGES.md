# OpenCode Manager Changes

This file is the consolidated high-level history of major architecture and product changes in this fork.

## Why This Fork Exists

- Keep compatibility with modern OpenCode SQLite storage.
- Preserve and improve JSONL compatibility.
- Ensure reliable Windows behavior and test execution.
- Prepare the TUI for long-term maintainability through seam-based refactoring.

## Storage and Data Layer

- Added a first-class SQLite implementation in `src/lib/opencode-data-sqlite.ts` for read/write/search/token operations.
- Added provider abstraction in `src/lib/opencode-data-provider.ts` with `jsonl`, `sqlite`, and `hybrid` backends.
- Default behavior now supports hybrid session loading when both SQLite and legacy JSON session data are available.
- Added schema validation and resilient warning behavior for malformed rows and partial data.
- Added strict and lock-handling flags surfaced through CLI/TUI arguments (`--sqlite-strict`, `--force-write`).

## CLI Evolution

- Expanded global options for storage control (`--experimental-sqlite`, `--db`).
- Routed command data access through provider-backed loading for `projects`, `sessions`, `chat`, and `tokens`.
- Preserved output-format behavior across `json`, `ndjson`, and `table` modes.
- Kept destructive workflows (`delete`, `rename`, `move`, `copy`) with backend-aware behavior.

## TUI Rewrite Preparation

- Shifted from monolithic logic toward typed and testable seams while preserving behavior.
- Introduced typed navigation/state model (`screen` + `overlay`) and explicit input-precedence routing.
- Added command registry and key router to centralize keyboard bindings and scope handling.
- Separated root-level resources for sessions, projects, tokens, chat session loads, and chat search.
- Extracted panel behavior seams (`projects-panel-input`, `sessions-panel-input`, derive/mode helpers).
- Extracted overlay host and lifecycle seams for help/chat/search/confirmation/project selector flows.
- Added repeatable timing-baseline helper (`src/tui/perf-baseline.ts`) for startup/path profiling summaries.

## Testing and Validation

- Expanded test coverage significantly across CLI, data providers, SQLite parity, and TUI seams.
- Added fixture-backed SQLite validation (`tests/fixtures/test.db`) and fixture tooling.
- Added benchmark assets (`scripts/benchmark-sqlite.ts`) and consolidated benchmark history into this doc set.
- Maintained full-suite green status during refactors with repeated typecheck and test runs.

## Documentation Consolidation

- Historical planning and progress docs were consolidated into this single high-level change log.
- Architecture and usage details now live in `README.md`.

## Attribution

- This codebase originated from `shuv1337/oc-manager` and has evolved significantly in this repository.
- Credit for the original product concept, TUI, and CLI foundations remains with the upstream author.

## Current Status

- SQLite support: implemented and production-usable in this fork.
- Hybrid mode: implemented.
- TUI rewrite-preparation phases: completed as documented in merged seam architecture.
- Remaining work is incremental polish and future enhancements rather than foundational migrations.
