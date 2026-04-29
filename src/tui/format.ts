import type { AggregateTokenSummary, TokenBreakdown, TokenSummary } from "../lib/opencode-data"

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  }
  return String(n)
}

export function formatTokenBreakdown(tokens: TokenBreakdown): string[] {
  return [
    `Input: ${formatTokenCount(tokens.input)}`,
    `Output: ${formatTokenCount(tokens.output)}`,
    `Reasoning: ${formatTokenCount(tokens.reasoning)}`,
    `Cache Read: ${formatTokenCount(tokens.cacheRead)}`,
    `Cache Write: ${formatTokenCount(tokens.cacheWrite)}`,
    `Total: ${formatTokenCount(tokens.total)}`,
  ]
}

export function formatTokenSummaryShort(summary: TokenSummary): string {
  if (summary.kind === "unknown") {
    return "?"
  }
  return formatTokenCount(summary.tokens.total)
}

export function formatAggregateSummaryShort(summary: AggregateTokenSummary): string {
  if (summary.total.kind === "unknown") {
    return "?"
  }
  const base = formatTokenCount(summary.total.tokens.total)
  if (summary.unknownSessions && summary.unknownSessions > 0) {
    return `${base} (+${summary.unknownSessions} unknown)`
  }
  return base
}
