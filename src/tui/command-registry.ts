export type CommandScope = "global" | "home" | "projects" | "sessions" | "chat" | "search" | "confirm"

export type Command = {
  id: string
  label: string
  scope: CommandScope
  keys: string[]
}

export type CommandRegistry = {
  register(command: Command): void
  getById(id: string): Command | undefined
  findByKey(key: string, scope: CommandScope): Command | undefined
  listByScope(scope: CommandScope): Command[]
  listByScopeOnly(scope: CommandScope): Command[]
}

export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, Command>()

  return {
    register(command: Command) {
      commands.set(command.id, command)
    },

    getById(id: string) {
      return commands.get(id)
    },

    findByKey(key: string, scope: CommandScope) {
      let globalMatch: Command | undefined
      for (const cmd of commands.values()) {
        if (!cmd.keys.includes(key)) {
          continue
        }
        if (cmd.scope === scope) {
          return cmd
        }
        if (cmd.scope === "global") {
          globalMatch = cmd
        }
      }
      return globalMatch
    },

    listByScope(scope: CommandScope) {
      const result: Command[] = []
      for (const cmd of commands.values()) {
        if (cmd.scope === "global") {
          result.push(cmd)
        } else if (cmd.scope === scope) {
          result.push(cmd)
        }
      }
      return result
    },

    listByScopeOnly(scope: CommandScope) {
      const result: Command[] = []
      for (const cmd of commands.values()) {
        if (cmd.scope === scope) {
          result.push(cmd)
        }
      }
      return result
    },
  }
}
