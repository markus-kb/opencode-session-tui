import type { TuiOverlay } from "./app-state"

export type InputPrecedenceContext = {
  screen: "home" | "projects" | "sessions"
  overlay: TuiOverlay | null
  searchActive: boolean
  confirmActive: boolean
}

export type InputLayer = "searchInput" | "confirm" | "chatViewer" | "chatSearch" | "home" | "workspace"

export function getInputLayer(ctx: InputPrecedenceContext): InputLayer {
  if (ctx.searchActive) {
    return "searchInput"
  }

  if (ctx.confirmActive) {
    return "confirm"
  }

  if (ctx.overlay?.name === "chatViewer") {
    return "chatViewer"
  }

  if (ctx.overlay?.name === "chatSearch") {
    return "chatSearch"
  }

  return ctx.screen === "home" ? "home" : "workspace"
}
