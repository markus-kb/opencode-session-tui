import { describe, expect, test } from "bun:test"
import { ProjectSelector } from "../../src/tui/project-selector"

describe("ProjectSelector", () => {
  test("exports the project selector overlay component", () => {
    expect(typeof ProjectSelector).toBe("function")
  })
})
