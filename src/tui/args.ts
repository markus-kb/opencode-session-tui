/**
 * TUI argument parsing module.
 *
 * Exports `parseArgs()` for parsing command-line arguments
 * and `TUIOptions` type for TUI configuration.
 */

import { resolve } from "node:path"
import { DEFAULT_ROOT } from "../lib/opencode-data"
import { DEFAULT_SQLITE_PATH } from "../lib/opencode-data-sqlite"
import type { StorageBackend } from "../lib/opencode-data-provider"
import { buildTuiCommands, type TuiCommandSet } from "./command-definitions"

export interface TUIOptions {
  root: string
  backend: StorageBackend
  dbPath?: string
  sqliteStrict: boolean
  forceWrite: boolean
}

const USAGE_SCOPE_TITLES: Record<string, string> = {
  home: "Home",
  global: "Global",
  projects: "Projects",
  sessions: "Sessions",
  chat: "Chat Viewer",
  search: "Chat Search",
  confirm: "Confirm",
}

export function getTuiKeyBindingUsage(cmdSet: TuiCommandSet = buildTuiCommands()): string {
  const lines = ["Key bindings:"]
  for (const section of cmdSet.getScopedKeyReference()) {
    lines.push(`\n${USAGE_SCOPE_TITLES[section.scope] ?? section.scope}:`)
    for (const cmd of section.commands) {
      lines.push(`  ${cmd.keys.join(" / ").padEnd(16)} ${cmd.label}`)
    }
  }
  return lines.join("\n")
}

/**
 * Print TUI usage/help text to console.
 */
export function printUsage(): void {
  console.log(`OpenCode Metadata TUI (fork)
Usage: bun run tui [-- --root /path/to/storage] [-- --experimental-sqlite] [-- --db /path/to/opencode.db]

Storage options:
  --root <path>             Root path to JSONL storage (default: ~/.local/share/opencode)
  --experimental-sqlite     Use SQLite backend instead of JSONL files
  --db <path>               Path to SQLite database (implies --experimental-sqlite)
  Default                   Hybrid mode when both SQLite and legacy JSON sessions exist
  --sqlite-strict           Fail on SQLite warnings or malformed data
  --force-write             Wait for SQLite write locks before failing

${getTuiKeyBindingUsage()}
`)
}

/**
 * Parse command-line arguments for TUI options.
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): TUIOptions {
  let root = DEFAULT_ROOT
  let backend: StorageBackend = "hybrid"
  let dbPath: string | undefined
  let sqliteStrict = false
  let forceWrite = false

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx]
    if (token === "--root" && argv[idx + 1]) {
      root = resolve(argv[idx + 1])
      idx += 1
      continue
    }
    if (token === "--db" && argv[idx + 1]) {
      dbPath = resolve(argv[idx + 1])
      backend = "sqlite"
      idx += 1
      continue
    }
    if (token === "--experimental-sqlite") {
      backend = "sqlite"
      continue
    }
    if (token === "--sqlite-strict") {
      sqliteStrict = true
      continue
    }
    if (token === "--force-write") {
      forceWrite = true
      continue
    }
    if (token === "--help" || token === "-h") {
      printUsage()
      process.exit(0)
    }
    if (token === "--version" || token === "-V") {
      console.log("0.4.6")
      process.exit(0)
    }
  }

  if (backend === "sqlite" && !dbPath) {
    dbPath = resolve(DEFAULT_SQLITE_PATH)
  }

  return {
    root: resolve(root),
    backend,
    dbPath,
    sqliteStrict,
    forceWrite,
  }
}
