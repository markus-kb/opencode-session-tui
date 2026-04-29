import type { ConfirmState } from "./confirm-bar"

export type ConfirmSnapshot = {
  state: ConfirmState | null
  busy: boolean
}

export const requestConfirmation = (state: ConfirmState): ConfirmSnapshot => ({ state, busy: false })

export const cancelConfirmation = (): ConfirmSnapshot => ({ state: null, busy: false })

export const startConfirmation = (state: ConfirmState | null, busy: boolean): {
  canExecute: boolean
  snapshot: ConfirmSnapshot
} => {
  if (!state || busy) {
    return { canExecute: false, snapshot: { state, busy } }
  }
  return { canExecute: true, snapshot: { state, busy: true } }
}

export const finishConfirmation = (): ConfirmSnapshot => ({ state: null, busy: false })
