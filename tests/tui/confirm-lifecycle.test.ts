import { describe, expect, test } from "bun:test"
import { cancelConfirmation, requestConfirmation, startConfirmation } from "../../src/tui/confirm-lifecycle"
import type { ConfirmState } from "../../src/tui/confirm-bar"

const state: ConfirmState = {
  title: "Delete sessions",
  items: ["one"],
  action: "Delete",
  onConfirm: async () => {},
}

describe("confirm lifecycle", () => {
  test("requesting a confirmation stores the state and clears busy", () => {
    expect(requestConfirmation(state)).toEqual({ state, busy: false })
  })

  test("cancelling clears state and busy", () => {
    expect(cancelConfirmation()).toEqual({ state: null, busy: false })
  })

  test("starting is ignored without state or while busy", () => {
    expect(startConfirmation(null, false)).toEqual({ canExecute: false, snapshot: { state: null, busy: false } })
    expect(startConfirmation(state, true)).toEqual({ canExecute: false, snapshot: { state, busy: true } })
  })

  test("starting with an idle state marks it busy and allows execution", () => {
    expect(startConfirmation(state, false)).toEqual({ canExecute: true, snapshot: { state, busy: true } })
  })
})
