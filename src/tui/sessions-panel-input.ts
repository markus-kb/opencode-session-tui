import type { TuiCommandSet } from "./command-definitions"
import { toCommandKey, resolveCommand } from "./key-router"
import { toSessionPanelAction, type SessionPanelAction } from "./session-panel-commands"

type KeyEventLike = {
  name?: string
  sequence?: string
  ctrl: boolean
  meta: boolean
}

export function resolveSessionsPanelInputAction({
  key,
  active,
  locked,
  cmdSet,
}: {
  key: KeyEventLike
  active: boolean
  locked: boolean
  cmdSet: TuiCommandSet
}): SessionPanelAction | undefined {
  if (!active || locked) {
    return
  }

  const cmdKey = toCommandKey(key)
  const cmdId = resolveCommand(cmdSet.registry, cmdKey, {
    screen: "sessions",
    overlay: null,
    searchActive: false,
    confirmActive: false,
  })
  return toSessionPanelAction(cmdId)
}
