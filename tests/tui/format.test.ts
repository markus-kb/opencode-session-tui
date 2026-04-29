import { describe, expect, test } from "bun:test"
import {
  formatAggregateSummaryShort,
  formatTokenBreakdown,
  formatTokenCount,
  formatTokenSummaryShort,
} from "../../src/tui/format"

describe("TUI formatting helpers", () => {
  test("formats raw token counts compactly", () => {
    expect(formatTokenCount(0)).toBe("0")
    expect(formatTokenCount(999)).toBe("999")
    expect(formatTokenCount(1_000)).toBe("1k")
    expect(formatTokenCount(1_500)).toBe("1.5k")
    expect(formatTokenCount(1_000_000)).toBe("1M")
    expect(formatTokenCount(1_250_000)).toBe("1.3M")
  })

  test("formats token breakdown lines", () => {
    expect(formatTokenBreakdown({
      input: 1_000,
      output: 2_500,
      reasoning: 0,
      cacheRead: 12,
      cacheWrite: 1_200_000,
      total: 1_203_512,
    })).toEqual([
      "Input: 1k",
      "Output: 2.5k",
      "Reasoning: 0",
      "Cache Read: 12",
      "Cache Write: 1.2M",
      "Total: 1.2M",
    ])
  })

  test("formats short token summary values", () => {
    expect(formatTokenSummaryShort({ kind: "known", tokens: {
      input: 10,
      output: 20,
      reasoning: 30,
      cacheRead: 40,
      cacheWrite: 50,
      total: 150,
    } })).toBe("150")

    expect(formatTokenSummaryShort({ kind: "unknown", reason: "missing" })).toBe("?")
  })

  test("formats aggregate summaries with unknown session counts", () => {
    expect(formatAggregateSummaryShort({
      total: { kind: "known", tokens: {
        input: 1_000,
        output: 2_000,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 3_000,
      } },
      unknownSessions: 2,
    })).toBe("3k (+2 unknown)")

    expect(formatAggregateSummaryShort({
      total: { kind: "unknown", reason: "no_messages" },
      unknownSessions: 1,
    })).toBe("?")
  })
})
