import { describe, it, expect } from "bun:test"
import { resolveOpenCommand } from "../../src/lib/open-path"

describe("resolveOpenCommand", () => {
  it("returns 'open' for darwin", () => {
    expect(resolveOpenCommand("darwin")).toBe("open")
  })

  it("returns 'explorer.exe' for win32", () => {
    expect(resolveOpenCommand("win32")).toBe("explorer.exe")
  })

  it("returns 'xdg-open' for linux", () => {
    expect(resolveOpenCommand("linux")).toBe("xdg-open")
  })

  it("returns 'xdg-open' for unknown platform", () => {
    expect(resolveOpenCommand("freebsd")).toBe("xdg-open")
  })
})
