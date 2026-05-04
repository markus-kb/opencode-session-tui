#!/usr/bin/env bun
/**
 * Main CLI entrypoint for opencode-session-tui.
 *
 * Routes between TUI and CLI modes based on provided subcommands:
 * - No subcommand → launches TUI
 * - "tui" subcommand → launches TUI
 * - CLI subcommands (projects, sessions, chat, tokens) → launches CLI
 *
 * Uses dynamic imports to keep initial load fast and avoid loading
 * unused modules.
 */

// Known CLI subcommands that should route to the CLI module
const CLI_SUBCOMMANDS = new Set([
  "projects",
  "sessions",
  "chat",
  "tokens",
])

// Subcommands that explicitly request TUI
const TUI_SUBCOMMANDS = new Set(["tui"])

// Version from package.json
const VERSION = "0.4.6"

function printHelp(): void {
  console.log(`opencode-session-tui v${VERSION} (fork)

Inspect and manage OpenCode metadata stores via TUI or CLI.

Forked from shuv1337/oc-manager and maintained here for the current
OpenCode SQLite schema plus Windows compatibility.

USAGE:
  opencode-session-tui [command] [options]

MODES:
  (no command)              Launch interactive TUI (default)
  tui                       Launch interactive TUI (terminal user interface)
  <command>                 Run CLI command (see below)

CLI COMMANDS:
  projects list             List all projects
  projects delete           Delete a project's metadata

  sessions list             List sessions (optionally filter by project)
  sessions delete           Delete a session's metadata
  sessions rename           Rename a session
  sessions move             Move a session to another project
  sessions copy             Copy a session to another project

  chat list                 List messages in a session
  chat show                 Show a specific message
  chat search               Search chat content across sessions

  tokens session            Show token usage for a session
  tokens project            Show token usage for a project
  tokens global             Show global token usage

OPTIONS:
  --help, -h                Show this help
  --version, -v             Show version

TUI STORAGE OPTIONS:
  opencode-session-tui --root <path>                 Launch TUI with legacy JSONL root
  opencode-session-tui --experimental-sqlite         Launch TUI in SQLite-only mode
  opencode-session-tui --db <path>                   Launch TUI with a specific SQLite database path
  opencode-session-tui tui --root <path>             Use a specific legacy JSONL storage root
  opencode-session-tui tui --experimental-sqlite     Force SQLite-only mode
  opencode-session-tui tui --db <path>               Use a specific SQLite database path

STORAGE DEFAULT:
  Hybrid mode is used by default when both opencode.db and legacy JSON sessions exist.

EXAMPLES:
  opencode-session-tui                              # Launch TUI (default)
  opencode-session-tui tui                          # Launch TUI
  opencode-session-tui tui --db ~/.local/share/opencode/opencode.db
  opencode-session-tui projects list --format json  # List projects as JSON
  opencode-session-tui sessions list --project X    # List sessions for project
  opencode-session-tui chat search --query "error"  # Search chat content

For detailed help on any command:
  opencode-session-tui <command> --help
  opencode-session-tui <command> <subcommand> --help
`)
}

function printVersion(): void {
  console.log(VERSION)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const firstArg = args[0]

  // Handle --help or -h
  if (firstArg === "--help" || firstArg === "-h") {
    printHelp()
    return
  }

  // No subcommand defaults to TUI.
  if (!firstArg) {
    const { bootstrap } = await import("../tui/index")
    await bootstrap([])
    return
  }

  // Handle --version or -v
  if (firstArg === "--version" || firstArg === "-v") {
    printVersion()
    return
  }

  // Root-level options (e.g. --db, --root, --experimental-sqlite) target TUI by default.
  if (firstArg.startsWith("-")) {
    const { bootstrap } = await import("../tui/index")
    await bootstrap(args)
    return
  }

  // Determine routing based on first argument
  const isCliSubcommand = CLI_SUBCOMMANDS.has(firstArg)
  const isTuiSubcommand = TUI_SUBCOMMANDS.has(firstArg)

  if (isCliSubcommand) {
    // Route to CLI module (dynamically imported)
    // Using string path to avoid TypeScript errors before CLI module exists
    const cliModulePath = "../cli/index"
    try {
      const cliModule = await import(cliModulePath)
      if (typeof cliModule.runCLI !== "function") {
        throw new Error("CLI module missing runCLI export")
      }
      await cliModule.runCLI(args)
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code
      const errMessage = (error as Error).message
      if (errCode === "ERR_MODULE_NOT_FOUND" || errMessage.includes("Cannot find module")) {
        console.error(`CLI module not yet implemented. Subcommand: ${firstArg}`)
        console.error("Run without subcommand to launch TUI, or use --help for usage.")
        process.exit(1)
      }
      throw error
    }
  } else if (isTuiSubcommand) {
    // Explicit TUI request - strip "tui" subcommand so TUI args parser doesn't see it
    const tuiArgs = args.slice(1)
    const { bootstrap } = await import("../tui/index")
    await bootstrap(tuiArgs)
  } else {
    // Unknown command
    console.error(`Unknown command: ${firstArg}\n`)
    printHelp()
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
