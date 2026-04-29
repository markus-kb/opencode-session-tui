import { createCommandRegistry, type Command, type CommandRegistry } from "./command-registry"

export type ScopedKeySection = {
  scope: CommandScope
  commands: Command[]
}

export type TuiCommandSet = {
  registry: CommandRegistry
  getHomeKeyReference: () => string[]
  getScopedKeyReference: () => ScopedKeySection[]
}

function cmd(id: string, label: string, scope: CommandScope, keys: string[]): Command {
  return { id, label, scope, keys }
}

type CommandScope = import("./command-registry").CommandScope

export function buildTuiCommands(): TuiCommandSet {
  const registry = createCommandRegistry()

  const commands: Command[] = [
    cmd("quit", "Quit", "global", ["q", "C-c"]),
    cmd("help", "Help", "global", ["?", "h"]),
    cmd("search", "Search", "global", ["/"]),
    cmd("clearSearch", "Clear search", "global", ["x"]),
    cmd("nextTab", "Next tab", "global", ["tab"]),
    cmd("tab1", "Projects tab", "global", ["1"]),
    cmd("tab2", "Sessions tab", "global", ["2"]),
    cmd("reload", "Reload", "global", ["r"]),
    cmd("chatSearch", "Chat search", "global", ["f"]),

    cmd("homeDismiss", "Open workspace", "home", ["enter", "escape"]),

    cmd("projects:toggleSelect", "Toggle selection", "projects", ["space"]),
    cmd("projects:toggleMissing", "Missing only", "projects", ["m"]),
    cmd("projects:selectAll", "Select all", "projects", ["a"]),
    cmd("projects:clearSelection", "Clear selection", "projects", ["escape"]),
    cmd("projects:deleteSelected", "Delete", "projects", ["d"]),
    cmd("projects:navigateToSessions", "Open sessions", "projects", ["enter"]),

    cmd("sessions:toggleSelect", "Toggle selection", "sessions", ["space"]),
    cmd("sessions:selectAll", "Select all", "sessions", ["a"]),
    cmd("sessions:toggleSort", "Toggle sort", "sessions", ["s"]),
    cmd("sessions:clearFilter", "Clear filter", "sessions", ["c"]),
    cmd("sessions:clearSelection", "Clear selection", "sessions", ["escape"]),
    cmd("sessions:deleteSelected", "Delete", "sessions", ["d"]),
    cmd("sessions:copyId", "Copy ID", "sessions", ["y"]),
    cmd("sessions:renameSession", "Rename", "sessions", ["R"]),
    cmd("sessions:moveSessions", "Move", "sessions", ["m"]),
    cmd("sessions:copySessions", "Copy", "sessions", ["p"]),
    cmd("sessions:viewChat", "View chat", "sessions", ["v"]),
    cmd("sessions:sessionInfo", "Session info", "sessions", ["enter"]),

    cmd("chat:close", "Close", "chat", ["escape"]),
    cmd("chat:prev", "Previous", "chat", ["up"]),
    cmd("chat:next", "Next", "chat", ["down"]),
    cmd("chat:pageUp", "Page up", "chat", ["pageup", "C-u"]),
    cmd("chat:pageDown", "Page down", "chat", ["pagedown", "C-d"]),
    cmd("chat:home", "First message", "chat", ["home"]),
    cmd("chat:end", "Last message", "chat", ["end"]),
    cmd("chat:copy", "Copy message", "chat", ["y"]),

    cmd("search:close", "Close", "search", ["escape"]),
    cmd("search:action", "Search/View", "search", ["enter"]),
    cmd("search:prev", "Previous result", "search", ["up"]),
    cmd("search:next", "Next result", "search", ["down"]),

    cmd("confirm:cancel", "Cancel", "confirm", ["escape", "n"]),
    cmd("confirm:ok", "Confirm", "confirm", ["enter", "y"]),
  ]

  for (const c of commands) {
    registry.register(c)
  }

  return {
    registry,
    getHomeKeyReference() {
      const homeCmds = registry.listByScope("home")
      const globalCmds = registry.listByScopeOnly("global")
      const lines: string[] = []
      for (const c of homeCmds) {
        lines.push(`[${c.keys.join("/")}] ${c.label}`)
      }
      for (const c of globalCmds) {
        lines.push(`[${c.keys.join("/")}] ${c.label}`)
      }
      return lines
    },
    getScopedKeyReference() {
      const scopes: CommandScope[] = ["home", "global", "projects", "sessions", "chat", "search", "confirm"]
      return scopes.map((scope) => ({
        scope,
        commands: registry.listByScopeOnly(scope),
      }))
    },
  }
}
