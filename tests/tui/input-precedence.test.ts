import { describe, expect, test } from "bun:test"
import { getInputLayer } from "../../src/tui/input-precedence"

describe("input precedence", () => {
  test("search input captures keys before overlays and panels", () => {
    expect(getInputLayer({ searchActive: true, confirmActive: true, overlay: { name: "chatViewer", sessionId: "s" }, screen: "sessions" })).toBe("searchInput")
  })

  test("confirm captures before chat overlays", () => {
    expect(getInputLayer({ searchActive: false, confirmActive: true, overlay: { name: "chatSearch" }, screen: "sessions" })).toBe("confirm")
  })

  test("chat overlays capture before workspace panels", () => {
    expect(getInputLayer({ searchActive: false, confirmActive: false, overlay: { name: "chatViewer", sessionId: "s" }, screen: "sessions" })).toBe("chatViewer")
    expect(getInputLayer({ searchActive: false, confirmActive: false, overlay: { name: "chatSearch" }, screen: "sessions" })).toBe("chatSearch")
  })

  test("falls back to home or workspace", () => {
    expect(getInputLayer({ searchActive: false, confirmActive: false, overlay: null, screen: "home" })).toBe("home")
    expect(getInputLayer({ searchActive: false, confirmActive: false, overlay: null, screen: "projects" })).toBe("workspace")
  })
})
