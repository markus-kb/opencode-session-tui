# AGENTS.md

Operational musts for coding agents working in this repository.

## Non-negotiables

1. **Strict TDD (Red -> Green -> Refactor)** for every behavior change.
   - Red: add/modify test first and prove failure.
   - Green: smallest implementation to pass.
   - Refactor: keep tests green.
2. **Always run before commit**:
   - `bunx tsc --noEmit`
   - `bun test`
3. **Do not silently break Windows workflows**.
   - Commands and docs must remain Windows-friendly.
4. **Preserve attribution** to `shuv1337/oc-manager` in user-facing docs.

## Launch and UX musts

1. Local launch must be simple:
   - `bun run start` launches TUI.
   - `bun run manager -- <cli args>` routes through main CLI entry.
2. Do not require users to run `bun run src/bin/opencode-manager.ts ...` for normal usage.
3. Keep help output accurate with script-based launch guidance.

## Architecture constraints

1. Resource loading policy is authoritative (`resource-policy.ts`).
2. Root-level session/project indexes are shared resources; avoid duplicate provider loads.
3. Chat viewer/search state must avoid stale async updates and unbounded cache growth.
4. Overlay and input precedence behavior must remain explicit and test-covered.

## Known realities

1. SQLite fixture tests intentionally emit warnings (malformed JSON / missing tables); warnings are expected in those tests.
2. A clipboard-related test in `tests/cli/commands/chat.test.ts` can be flaky in full-suite runs.
3. Memory-sensitive paths:
   - long chat sessions
   - hydrated message parts cache
   - delayed search->open-chat cursor handoff

## Documentation discipline

1. Keep `README.md` and `docs/CHANGES.md` consistent with behavior.
2. Remove stale references when files/URLs move.
3. If repository URL changes, update:
   - install/clone instructions in `README.md`
   - `repository.url` and `bugs.url` in `package.json`
