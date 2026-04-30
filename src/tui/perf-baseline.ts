export type TimingSummary = {
  samples: number
  minMs: number
  maxMs: number
  avgMs: number
  medianMs: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function summarizeTimings(samples: number[]): TimingSummary {
  if (samples.length === 0) {
    return {
      samples: 0,
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      medianMs: 0,
    }
  }

  const sorted = [...samples].sort((a, b) => a - b)
  const minMs = sorted[0]
  const maxMs = sorted[sorted.length - 1]
  const avgMs = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  const middle = Math.floor(sorted.length / 2)
  const medianMs =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]

  return {
    samples: sorted.length,
    minMs: round(minMs),
    maxMs: round(maxMs),
    avgMs: round(avgMs),
    medianMs: round(medianMs),
  }
}
