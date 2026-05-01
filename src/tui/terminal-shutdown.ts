type RendererLike = {
  destroy: () => void
}

type StdoutLike = {
  write: (chunk: string) => boolean
}

export const TERMINAL_CLEANUP_ANSI = "\x1b[0m\x1b[?25h\x1b[?1049l\x1b[2J\x1b[H"

export function writeTerminalCleanup(stdout: StdoutLike): void {
  stdout.write(TERMINAL_CLEANUP_ANSI)
}

export function createTerminalShutdown(renderer: RendererLike, stdout: StdoutLike): () => void {
  let shutdown = false

  return () => {
    if (shutdown) {
      return
    }
    shutdown = true

    try {
      renderer.destroy()
    } catch {
      // Ignore renderer teardown errors so terminal cleanup still runs.
    } finally {
      writeTerminalCleanup(stdout)
    }
  }
}
