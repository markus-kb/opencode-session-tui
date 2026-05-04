## Context and Goals
- Request: produce a comprehensive plan to update all documentation so it matches the current app behavior and codebase.
- Constraint: plan only; no implementation or doc edits in this task.
- Scope focus: repo-local documentation (`README.md`, `PROJECT-SUMMARY.md`, `plan.md`, `tests/fixtures/README.md`) plus any embedded usage text (e.g., CLI/TUI help, wrapper usage) that documentation references.

## Decisions and Rationale
- Source-of-truth is the current codebase, not prior docs, to avoid repeating outdated behavior.
- Include the CLI/TUI surface as "API" specs since there are no network endpoints; this is what users integrate with.
- Only use external sources if a doc claim depends on third-party behavior or upstream schema details.
- Preserve the project's community-maintained disclaimer in `README.md` while updating the rest of the content.

### Source-of-Truth Priority (When Conflicts Arise)
When documentation and code conflict, resolve using this priority:
1. **Current runtime behavior** (what the code actually does)
2. **Code comments** (inline documentation)
3. **CLI/TUI help text** (`.description()` strings, `printUsage()`)
4. **README.md** (user-facing docs)
5. **PROJECT-SUMMARY.md** (architecture notes)

## Known Pre-Existing Issues (Found During Review)
These issues exist TODAY and must be fixed during implementation:

| Issue | Current State | Expected State | File(s) |
|-------|---------------|----------------|---------|
| Bun version mismatch | README says "1.1.0+" | package.json requires ">=1.3.0" | `README.md:61`, `package.json:9` |
| Root CLI description never shown | `src/cli/index.ts:79` has description | Users see TUI help instead | `src/bin/opencode-manager.ts` routing |

## Issue Integration
- No GitHub issue provided; plan assumes "align documentation with current app state" is the sole requirement.

## Documentation Inventory (Targets to Update)
| Doc Path | Purpose | Notes for Update |
| --- | --- | --- |
| `README.md` | Primary user-facing doc (features, usage, CLI/TUI keys) | Likely needs version/requirements + command parity verification |
| `PROJECT-SUMMARY.md` | Architecture + design notes | Must match current file structure and feature set |
| `plan.md` | Historical backlog | Mark as historical or update headers to avoid misleading readers |
| `tests/fixtures/README.md` | Fixture schema + layout | Ensure schema details match current data layer expectations |

## Internal Source-of-Truth References
| Path | What It Defines |
| --- | --- |
| `package.json` | Version, Bun engine requirement, scripts |
| `src/bin/opencode-manager.ts` | CLI/TUI routing behavior |
| `src/cli/index.ts` | Global CLI options + defaults |
| `src/cli/commands/projects.ts` | `projects` subcommands + flags |
| `src/cli/commands/sessions.ts` | `sessions` subcommands + flags |
| `src/cli/commands/chat.ts` | `chat` subcommands + flags |
| `src/cli/commands/tokens.ts` | `tokens` subcommands + flags |
| `src/cli/commands/tui.ts` | `tui` subcommand help text |
| `src/cli/errors.ts` | CLI exit codes + error semantics |
| `src/cli/output.ts` | Output format semantics |
| `src/cli/formatters/json.ts` | JSON envelope/metadata |
| `src/lib/opencode-data.ts` | Storage layout, data models, token logic, chat search |
| `src/lib/search.ts` | Search behavior (tokenized + fuzzy) |
| `src/lib/clipboard.ts` | Clipboard requirements (pbcopy/xclip) |
| `src/tui/args.ts` | TUI help text + key bindings |
| `src/tui/app.tsx` | TUI feature behavior (tokens, chat viewer/search, rename/move/copy) |
| `manage_opencode_projects.py` | Legacy wrapper usage + routing |
| `home-screen.png` | Main UI screenshot |
| `help-screen.png` | Help UI screenshot |

## External References (Use Only If Needed)
| Git URL | Why It Might Be Needed | Notes |
| --- | --- | --- |
| `https://github.com/open-tui/opentui` | Confirm UI library name/usage phrasing | Referenced in README |
| `https://github.com/oven-sh/bun` | Confirm Bun version requirements language | Aligns with `package.json` engines |
| `https://github.com/commander-js/commander.js` | If documenting CLI framework usage | Optional |
| `https://github.com/mattyork/fast-fuzzy` | If documenting fuzzy search behavior | Optional |

## Technical Specifications to Capture in Docs
### CLI Interface (Primary "API")
- Global options (from `src/cli/index.ts`): `--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`.
- Subcommands and flags:
  - `projects list` (`--missing-only`, `--search`)
  - `projects delete` (`--id`, `--yes`, `--dry-run`, `--backup-dir`)
  - `sessions list` (`--project`, `--search`)
  - `sessions delete` (`--session`, `--yes`, `--dry-run`, `--backup-dir`)
  - `sessions rename` (`--session`, `--title`)
  - `sessions move` (`--session`, `--to`)
  - `sessions copy` (`--session`, `--to`)
  - `chat list` (`--session`, `--include-parts`)
  - `chat show` (`--session`, `--message` or `--index`, uses global `--clipboard`)
  - `chat search` (`--query`, `--project`)
  - `tokens session` (`--session`)
  - `tokens project` (`--project`)
  - `tokens global` (no flags)
  - `tui` (launch TUI explicitly)
- Version output: `opencode-manager --version` must match `package.json`.
- Output formats (`json`, `ndjson`, `table`) including JSON envelope structure and list metadata.
- ID resolution behavior: projects/sessions/chat allow prefix matching; tokens uses exact IDs; `chat show` accepts message ID prefix or 1-based index.

### Help Output Routing (Critical Detail)
The CLI has **two separate help systems** that must be documented clearly:

| Command | What Shows | Source File | Notes |
|---------|------------|-------------|-------|
| `opencode-manager --help` | TUI help (key bindings) | `src/tui/args.ts:18-64` | Routes to TUI module, bypasses Commander |
| `opencode-manager -h` | TUI help (key bindings) | `src/tui/args.ts:18-64` | Same as above |
| `opencode-manager --version` | Version string | `src/cli/index.ts:80` | Shows package version |
| `opencode-manager projects --help` | Commander CLI help | `src/cli/commands/projects.ts` | Shows subcommands list/delete |
| `opencode-manager projects list --help` | Commander CLI help | `src/cli/commands/projects.ts` | Shows list options |
| `opencode-manager sessions --help` | Commander CLI help | `src/cli/commands/sessions.ts` | Shows subcommands |
| `opencode-manager chat --help` | Commander CLI help | `src/cli/commands/chat.ts` | Shows subcommands |
| `opencode-manager tokens --help` | Commander CLI help | `src/cli/commands/tokens.ts` | Shows subcommands |
| `opencode-manager tui --help` | TUI help (key bindings) | `src/tui/args.ts:18-64` | Routes to TUI, not Commander |

**Key Insight**: The root Commander program description at `src/cli/index.ts:79` ("CLI for managing OpenCode metadata stores") is **never displayed** to users because `--help` without a subcommand routes to the TUI module.

### CLI Help Text Locations (All `.description()` Calls)
| File | Line | Current Text | Needs Review |
|------|------|--------------|--------------|
| `src/cli/index.ts` | 79 | "CLI for managing OpenCode metadata stores" | Yes - never shown |
| `src/cli/commands/projects.ts` | 71 | "Manage OpenCode projects" | Yes |
| `src/cli/commands/projects.ts` | 75 | "List projects" | Yes |
| `src/cli/commands/projects.ts` | 90 | "Delete a project's metadata file" | Yes |
| `src/cli/commands/sessions.ts` | 105 | "Manage OpenCode sessions" | Yes |
| `src/cli/commands/sessions.ts` | 109 | "List sessions" | Yes |
| `src/cli/commands/sessions.ts` | 124 | "Delete a session's metadata file" | Yes |
| `src/cli/commands/sessions.ts` | 147 | "Rename a session" | Yes |
| `src/cli/commands/sessions.ts` | 165 | "Move a session to another project" | Yes |
| `src/cli/commands/sessions.ts` | 182 | "Copy a session to another project" | Yes |
| `src/cli/commands/chat.ts` | 84 | "View and search chat messages" | Yes |
| `src/cli/commands/chat.ts` | 88 | "List messages in a session" | Yes |
| `src/cli/commands/chat.ts` | 106 | "Show a specific message" | Yes |
| `src/cli/commands/chat.ts` | 129 | "Search chat content across sessions" | Yes |
| `src/cli/commands/tokens.ts` | 57 | "View token usage statistics" | Yes |
| `src/cli/commands/tokens.ts` | 61 | "Show token usage for a session" | Yes |
| `src/cli/commands/tokens.ts` | 78 | "Show token usage for a project" | Yes |
| `src/cli/commands/tokens.ts` | 95 | "Show global token usage" | Yes |
| `src/cli/commands/tui.ts` | 30 | "Launch the Terminal UI" | Yes - minimal |

### TUI Behavior
- Key bindings from `src/tui/args.ts` including global actions, Projects view, Sessions view, chat search, and chat viewer.
- Features to describe: search modes, rename/move/copy, chat viewer, chat search, token summaries, confirmation workflows.

### Data Model and Storage Layout
```text
<root>/storage/
  project/<projectId>.json
  sessions/<projectId>.json
  session/<projectId>/<sessionId>.json
  message/<sessionId>/<messageId>.json
  part/<messageId>/<partId>.json
  session/message/<sessionId>/<messageId>.json   (legacy fallback)
  session/part/<messageId>/<partId>.json         (legacy fallback)
```
- Legacy fallback paths exist under `storage/session/message` and `storage/session/part` for older stores.
- Project schema: `id`, `worktree`, `vcs`, `time.created`.
- Session schema: `id`, `projectID`, `directory`, `title`, `version`, `time.created`, `time.updated`.
- Message schema: `id`, `sessionID`, `role`, `time.created`, `parentID`, `tokens.{input,output,reasoning,cache.read,cache.write}`.
- Part schema: `text`, `tool`, `subtask` parts plus tool status fields.
- Token summary output includes `kind` (`known`/`unknown`), `reason` when unknown, and aggregate fields like `knownOnly` and `unknownSessions` alongside breakdown totals.

### Configuration and Integration Points
| Item | Value/Behavior | Source |
| --- | --- | --- |
| Default root | `~/.local/share/opencode` | `src/lib/opencode-data.ts` |
| Bun requirement | `>=1.3.0` (package engine) | `package.json` |
| Clipboard | `pbcopy` (macOS), `xclip` (Linux), no Windows support | `src/lib/clipboard.ts`, `README.md` |
| Entry points | `src/bin/opencode-manager.ts`, `manage_opencode_projects.py` | Code + README |

### CLI Error and Exit Codes
- Exit codes (from `src/cli/errors.ts`): 0 success, 1 general error, 2 usage error, 3 not found, 4 file operation failure.
- Document delete safeguards and confirmation errors (e.g., missing `--yes`).

## Implementation Plan (Milestones and Tasks)

### Milestone 0: Decision Checkpoints (Before Implementation)
- [ ] **DECISION**: Should `opencode-manager --help` show CLI subcommand overview in addition to TUI keys?
  - Current: Shows only TUI help via `src/tui/args.ts:printUsage()`
  - Option A: Keep current behavior, document it clearly
  - Option B: Append CLI subcommand list to TUI help output
  - Option C: Change routing so root `--help` shows Commander help
- [ ] **DECISION**: Should `opencode-manager tui --help` show Commander help or TUI help?
  - Current: Shows TUI help (same as root `--help`)
  - Consider: Users may expect `tui --help` to explain the `tui` subcommand
- [ ] **DECISION**: Should the root Commander description (`src/cli/index.ts:79`) be updated even though it's never shown?
  - Keep for future-proofing vs remove dead code

### Milestone 1: Audit and Gap Analysis
- [ ] Inventory all doc claims in `README.md` and `PROJECT-SUMMARY.md` and map each claim to a source file.
- [ ] **FIX PRE-EXISTING BUG**: Update `README.md` Bun version from "1.1.0+" to "1.3.0+" to match `package.json`.
- [ ] Diff CLI commands/options in docs vs `src/cli/**` (global options, subcommands, flags).
- [ ] Audit CLI/TUI help output sources and routing (Commander help vs `src/tui/args.ts`; note `opencode-manager --help` routes to TUI).
- [ ] Verify CLI version output vs `package.json` (`opencode-manager --version`).
- [ ] Verify `.version()` in `src/cli/index.ts:80` matches `package.json` version.
- [ ] Diff TUI key bindings in docs vs `src/tui/args.ts` and `src/tui/app.tsx`.
- [ ] Verify data model/storage layout in docs vs `src/lib/opencode-data.ts` and `tests/fixtures/README.md`, including legacy `storage/session/*` fallbacks.
- [ ] Capture ID resolution behavior per command (prefix vs exact; `chat show` index).
- [ ] Capture CLI exit codes and error semantics from `src/cli/errors.ts`.
- [ ] Identify any stale references (file paths, script names, module names).
- [ ] Record gaps and mismatches as a checklist for doc updates.

### Milestone 2: Update Core Documentation
- [ ] Update `README.md` requirements (Bun version) and installation commands to match `package.json`.
- [ ] Refresh `README.md` feature list to reflect current CLI + TUI behaviors (search, chat viewer, tokens, rename/move/copy).
- [ ] Update `README.md` CLI section with exact subcommands, global options, and output formats.
- [ ] Document help routing (`opencode-manager --help` for TUI vs `opencode-manager <subcommand> --help` for CLI).
- [ ] Re-validate `README.md` examples to match current flags and output envelope details.
- [ ] Update `README.md` troubleshooting to match current known constraints (tmux note, clipboard behavior).
- [ ] Document delete semantics (metadata only; session delete leaves message files).
- [ ] Update token summary docs to include `kind`/`reason` and aggregate `unknownSessions`.
- [ ] Add CLI exit codes and error meanings.
- [ ] Update `PROJECT-SUMMARY.md` architecture tree and module list to match current `src/` layout.
- [ ] Update `PROJECT-SUMMARY.md` feature summaries to align with actual CLI/TUI behavior and token handling.

### Milestone 2a: Update CLI Help Text (All `.description()` Strings)
- [ ] Review and update root program description in `src/cli/index.ts:79`.
- [ ] Review and update `projects` command group description in `src/cli/commands/projects.ts:71`.
- [ ] Review and update `projects list` description in `src/cli/commands/projects.ts:75`.
- [ ] Review and update `projects delete` description in `src/cli/commands/projects.ts:90`.
- [ ] Review and update `sessions` command group description in `src/cli/commands/sessions.ts:105`.
- [ ] Review and update `sessions list` description in `src/cli/commands/sessions.ts:109`.
- [ ] Review and update `sessions delete` description in `src/cli/commands/sessions.ts:124`.
- [ ] Review and update `sessions rename` description in `src/cli/commands/sessions.ts:147`.
- [ ] Review and update `sessions move` description in `src/cli/commands/sessions.ts:165`.
- [ ] Review and update `sessions copy` description in `src/cli/commands/sessions.ts:182`.
- [ ] Review and update `chat` command group description in `src/cli/commands/chat.ts:84`.
- [ ] Review and update `chat list` description in `src/cli/commands/chat.ts:88`.
- [ ] Review and update `chat show` description in `src/cli/commands/chat.ts:106`.
- [ ] Review and update `chat search` description in `src/cli/commands/chat.ts:129`.
- [ ] Review and update `tokens` command group description in `src/cli/commands/tokens.ts:57`.
- [ ] Review and update `tokens session` description in `src/cli/commands/tokens.ts:61`.
- [ ] Review and update `tokens project` description in `src/cli/commands/tokens.ts:78`.
- [ ] Review and update `tokens global` description in `src/cli/commands/tokens.ts:95`.
- [ ] Review and update `tui` subcommand description in `src/cli/commands/tui.ts:30`.
- [ ] Review all `.option()` help strings for accuracy and consistency.

### Milestone 2b: Update TUI Help Text
- [ ] Review and update TUI help output in `src/tui/args.ts:printUsage()` to match docs and current key bindings.
- [ ] Verify TUI in-app help overlay matches `src/tui/args.ts` help text.
- [ ] **OPTIONAL**: Add CLI subcommand overview to TUI help output (if Decision M0 approves).

### Milestone 3: Update Supplemental Documentation
- [ ] Update `tests/fixtures/README.md` to reflect the current message/part schema, token fields, and legacy storage paths.
- [ ] Review `plan.md` for outdated statements; label as historical or update the intro to clarify its status.
- [ ] Update `manage_opencode_projects.py` usage references in docs (if any) to match wrapper behavior.
- [ ] Replace or annotate `home-screen.png` and `help-screen.png` if UI no longer matches descriptions.

### Milestone 4: External Reference Checks (If Needed)
- [ ] Use GitHub code search to confirm any third-party behaviors that docs describe (OpenTUI usage, fast-fuzzy semantics) and capture Git URLs in docs or footnotes.
- [ ] Ensure all third-party links point to canonical GitHub repos (for reproducible tooling).

### Milestone 5: Validation and Final Review

#### 5a: Version and Requirements Validation
- [ ] Validate `opencode-manager --version` matches `package.json`.
- [ ] Validate `.version()` in `src/cli/index.ts` matches `package.json`.
- [ ] Validate Bun version requirement in README matches `package.json` engines.

#### 5b: Help Output Validation (Run All Commands)
Run each command and verify output matches documentation:

```bash
# Root help (should show TUI help)
bun run src/bin/opencode-manager.ts --help
bun run src/bin/opencode-manager.ts -h

# Version
bun run src/bin/opencode-manager.ts --version

# Projects commands
bun run src/bin/opencode-manager.ts projects --help
bun run src/bin/opencode-manager.ts projects list --help
bun run src/bin/opencode-manager.ts projects delete --help

# Sessions commands
bun run src/bin/opencode-manager.ts sessions --help
bun run src/bin/opencode-manager.ts sessions list --help
bun run src/bin/opencode-manager.ts sessions delete --help
bun run src/bin/opencode-manager.ts sessions rename --help
bun run src/bin/opencode-manager.ts sessions move --help
bun run src/bin/opencode-manager.ts sessions copy --help

# Chat commands
bun run src/bin/opencode-manager.ts chat --help
bun run src/bin/opencode-manager.ts chat list --help
bun run src/bin/opencode-manager.ts chat show --help
bun run src/bin/opencode-manager.ts chat search --help

# Tokens commands
bun run src/bin/opencode-manager.ts tokens --help
bun run src/bin/opencode-manager.ts tokens session --help
bun run src/bin/opencode-manager.ts tokens project --help
bun run src/bin/opencode-manager.ts tokens global --help

# TUI subcommand (should show TUI help, not Commander help)
bun run src/bin/opencode-manager.ts tui --help
```

- [ ] Document any discrepancies found during validation.
- [ ] Verify all 14 leaf commands show accurate help.

#### 5c: Documentation Consistency
- [ ] Validate TUI help text vs documentation (`bun run tui -- --help`).
- [ ] Spot-check command examples against fixture data or a real store to ensure correctness.
- [ ] Run a final doc consistency pass for file paths, script names, and version numbers.
- [ ] Verify help routing is documented correctly in README.

## Validation Criteria
- [ ] Every CLI flag and subcommand documented matches `src/cli/**` and `src/cli/commands/tui.ts`.
- [ ] All 19 `.description()` strings reviewed and updated as needed.
- [ ] CLI help output matches docs for each subcommand, and `opencode-manager --help` is documented as TUI help.
- [ ] TUI key bindings and help text match `src/tui/args.ts` and help overlay in `src/tui/app.tsx`.
- [ ] Data model and storage layout (including legacy paths) match `src/lib/opencode-data.ts` and fixtures.
- [ ] Token summary docs include `kind`/`reason` and aggregate `unknownSessions`.
- [ ] CLI exit codes and error semantics match `src/cli/errors.ts`.
- [ ] CLI version output matches `package.json`.
- [ ] `.version()` in code matches `package.json`.
- [ ] Requirements and scripts match `package.json`.
- [ ] Screenshot captions and descriptions match the current UI.

## Suggestions (Nice-to-Have Improvements)

### Add CLI Overview to TUI Help
The TUI help (`src/tui/args.ts:printUsage()`) only shows key bindings. Consider appending:
```
CLI subcommands (use <cmd> --help for details):
  projects    Manage OpenCode projects
  sessions    Manage OpenCode sessions
  chat        View and search chat messages
  tokens      View token usage statistics
```

### Capture Help Output as Test Fixtures
Add snapshot tests for help output to catch regressions:
- `tests/fixtures/help/root.txt` - Output of `--help`
- `tests/fixtures/help/projects.txt` - Output of `projects --help`
- etc.

### Add Shell Completion Scripts
Consider generating completion scripts for bash/zsh/fish to improve CLI discoverability.

## Open Questions / Assumptions
- Are `home-screen.png` / `help-screen.png` up to date or should new screenshots be captured?
- Should `plan.md` remain as a historical log or be updated to a current roadmap?
- Are there any non-markdown docs outside this repo scope that should be included?
- Should the root Commander description be removed since it's never shown? (See Milestone 0 decisions)
