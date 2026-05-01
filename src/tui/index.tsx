/**
 * TUI entrypoint module.
 *
 * Exports `launchTUI(args)` for starting the fork's OpenCode Metadata TUI.
 * This module serves as the public interface for launching the TUI,
 * allowing both direct execution and programmatic invocation from CLI.
 *
 * Imports the App component from `./app.tsx` for rendering.
 */

import { createRoot } from "@opentui/react"
import { createCliRenderer } from "@opentui/core"

import { App } from "./app"
import { DEFAULT_ROOT } from "../lib/opencode-data"
import { DEFAULT_SQLITE_PATH } from "../lib/opencode-data-sqlite"
import { parseArgs, printUsage, type TUIOptions } from "./args"
import { writeTerminalCleanup } from "./terminal-shutdown"

// Re-export args module for external consumers
export { parseArgs, printUsage, type TUIOptions }

/**
 * Launch the TUI with the given options.
 * This is the main entrypoint for starting the TUI.
 */
export async function launchTUI(options?: Partial<TUIOptions>): Promise<void> {
  const root = options?.root ?? DEFAULT_ROOT
  const backend = options?.backend ?? (options?.dbPath ? "sqlite" : "hybrid")
  const sqliteStrict = options?.sqliteStrict ?? false
  const forceWrite = options?.forceWrite ?? false
  const dbPath = backend === "sqlite" || backend === "hybrid" ? (options?.dbPath ?? DEFAULT_SQLITE_PATH) : undefined

  let terminalCleanupDone = false
  const cleanupTerminal = () => {
    if (terminalCleanupDone) {
      return
    }
    terminalCleanupDone = true
    writeTerminalCleanup(process.stdout)
  }

  const renderer = await createCliRenderer({
    onDestroy: cleanupTerminal,
  })

  const onQuit = () => {
    renderer.destroy()
  }

  createRoot(renderer).render(
    <App
      root={root}
      backend={backend}
      dbPath={dbPath}
      sqliteStrict={sqliteStrict}
      forceWrite={forceWrite}
      onQuit={onQuit}
    />
  )
}

/**
 * Bootstrap the TUI from command-line arguments.
 * Parses args and launches the TUI.
 *
 * @param argv - Optional argument array (defaults to process.argv.slice(2))
 */
export async function bootstrap(argv?: string[]): Promise<void> {
  const options = parseArgs(argv)
  await launchTUI(options)
}

// Auto-bootstrap when run directly
bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
