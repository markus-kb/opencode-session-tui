import { describe, expect, test } from "bun:test"
import { HomeScreen } from "../../src/tui/home-screen"

describe("HomeScreen", () => {
  test("exports the dashboard home screen component", () => {
    expect(typeof HomeScreen).toBe("function")
  })
})
