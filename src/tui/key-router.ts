import type { CommandRegistry, CommandScope } from "./command-registry"
import type { TuiOverlay } from "./app-state"

export type KeyRouteContext = {
  screen: "home" | "projects" | "sessions"
  overlay: TuiOverlay | null
  searchActive: boolean
  confirmActive: boolean
}

type KeyEventLike = {
  name?: string
  sequence?: string
  ctrl: boolean
  meta: boolean
}

export function toCommandKey(key: KeyEventLike): string {
  if (key.ctrl) {
    return "C-" + (key.name ?? "")
  }

  if (key.name === "space" || key.name === "enter" || key.name === "return" || key.name === "escape" || key.name === "up" || key.name === "down" || key.name === "pageup" || key.name === "pagedown" || key.name === "home" || key.name === "end" || key.name === "tab" || key.name === "backspace") {
    return key.name === "return" ? "enter" : key.name
  }

  if (key.sequence && key.sequence.length === 1) {
    return key.sequence
  }

  return key.name ?? ""
}

export function toCommandScope(ctx: KeyRouteContext): CommandScope {
  if (ctx.confirmActive) {
    return "confirm"
  }

  if (ctx.overlay?.name === "chatViewer") {
    return "chat"
  }

  if (ctx.overlay?.name === "chatSearch") {
    return "search"
  }

  if (ctx.screen === "home") {
    return "home"
  }

  return ctx.screen
}

export function resolveCommand(
  registry: CommandRegistry,
  commandKey: string,
  ctx: KeyRouteContext,
): string | undefined {
  const scope = toCommandScope(ctx)
  const cmd = registry.findByKey(commandKey, scope)
  return cmd?.id
}
