import { describe, expect, test } from "bun:test"
import { buildDeletionConfirmDetails, buildDeletionConfirmTitle } from "../../src/tui/confirm-payload"

describe("confirm payload", () => {
  test("builds singular and plural deletion titles", () => {
    expect(buildDeletionConfirmTitle(1, "project metadata entry")).toBe("Delete 1 project metadata entry?")
    expect(buildDeletionConfirmTitle(2, "project metadata entry")).toBe("Delete 2 project metadata entries?")
  })

  test("builds capped detail list from selected items", () => {
    const selected = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const details = buildDeletionConfirmDetails(selected, {
      maxPreview: 2,
      describe: (item) => `item:${item.id}`,
    })

    expect(details).toEqual(["item:a", "item:b"])
  })
})
