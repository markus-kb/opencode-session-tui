import { describe, expect, test } from "bun:test"
import { summarizeTimings } from "../../src/tui/perf-baseline"

describe("perf baseline", () => {
  test("summarizes min/max/avg/median for timing samples", () => {
    const summary = summarizeTimings([100, 200, 300, 400])

    expect(summary).toEqual({
      samples: 4,
      minMs: 100,
      maxMs: 400,
      avgMs: 250,
      medianMs: 250,
    })
  })

  test("returns zeros for empty sample sets", () => {
    expect(summarizeTimings([])).toEqual({
      samples: 0,
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      medianMs: 0,
    })
  })
})
