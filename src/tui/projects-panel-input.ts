import type { TuiCommandSet } from "./command-definitions"
import { toCommandKey, resolveCommand } from "./key-router"
import { toProjectPanelAction, type ProjectPanelAction } from "./project-panel-commands"

type KeyEventLike = {
  name?: string
  sequence?: string
  ctrl: boolean
  meta: boolean
}

export function resolveProjectPanelInputAction({
  key,
  active,
  locked,
  cmdSet,
}: {
  key: KeyEventLike
  active: boolean
  locked: boolean
  cmdSet: TuiCommandSet
}): ProjectPanelAction | undefined {
  if (!active || locked) {
    return
  }

  const cmdKey = toCommandKey(key)
  const cmdId = resolveCommand(cmdSet.registry, cmdKey, {
    screen: "projects",
    overlay: null,
    searchActive: false,
    confirmActive: false,
  })
  return toProjectPanelAction(cmdId)
}
