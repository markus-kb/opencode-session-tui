/**
 * JSON output formatter for CLI commands.
 *
 * Provides standard JSON output helpers for formatting single records,
 * arrays, and structured responses with consistent serialization.
 */

/**
 * Options for JSON formatting.
 */
export interface JsonFormatOptions {
  /** Pretty-print with indentation (default: true for TTY, false otherwise) */
  pretty?: boolean
  /** Indentation level for pretty printing (default: 2) */
  indent?: number
}

/**
 * Standard JSON response envelope for CLI output.
 */
export interface JsonResponse<T> {
  /** Whether the operation was successful */
  ok: boolean
  /** The data payload */
  data?: T
  /** Error message if operation failed */
  error?: string
  /** Optional metadata about the response */
  meta?: {
    /** Total count of items (for paginated results) */
    count?: number
    /** Limit applied to results */
    limit?: number
    /** Whether results were truncated due to limit */
    truncated?: boolean
  }
}

/**
 * Determine if output should be pretty-printed.
 * Defaults to pretty for TTY, compact for piped output.
 */
function shouldPrettyPrint(options?: JsonFormatOptions): boolean {
  if (options?.pretty !== undefined) {
    return options.pretty
  }
  // Default: pretty for TTY, compact for pipes
  return process.stdout.isTTY ?? false
}

/**
 * Get the indentation string for pretty printing.
 */
function getIndent(options?: JsonFormatOptions): number | undefined {
  if (!shouldPrettyPrint(options)) {
    return undefined
  }
  return options?.indent ?? 2
}

/**
 * Custom replacer function to handle special types during JSON serialization.
 * - Converts Date objects to ISO strings
 * - Handles undefined values
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

/**
 * Format a single value as JSON.
 */
export function formatJson<T>(data: T, options?: JsonFormatOptions): string {
  const indent = getIndent(options)
  return JSON.stringify(data, jsonReplacer, indent)
}

/**
 * Format an array of values as JSON.
 */
export function formatJsonArray<T>(data: T[], options?: JsonFormatOptions): string {
  const indent = getIndent(options)
  return JSON.stringify(data, jsonReplacer, indent)
}

/**
 * Format a successful response with data.
 */
export function formatJsonSuccess<T>(
  data: T,
  meta?: JsonResponse<T>["meta"],
  options?: JsonFormatOptions
): string {
  const response: JsonResponse<T> = {
    ok: true,
    data,
    ...(meta && { meta }),
  }
  return formatJson(response, options)
}

/**
 * Format a successful response with an array of data.
 * Automatically populates count metadata.
 */
export function formatJsonArraySuccess<T>(
  data: T[],
  meta?: Omit<NonNullable<JsonResponse<T[]>["meta"]>, "count">,
  options?: JsonFormatOptions
): string {
  const response: JsonResponse<T[]> = {
    ok: true,
    data,
    meta: {
      count: data.length,
      ...meta,
    },
  }
  return formatJson(response, options)
}

/**
 * Format an error response.
 */
export function formatJsonError(
  error: string | Error,
  options?: JsonFormatOptions
): string {
  const message = error instanceof Error ? error.message : error
  const response: JsonResponse<never> = {
    ok: false,
    error: message,
  }
  return formatJson(response, options)
}

/**
 * Print JSON to stdout.
 */
export function printJson<T>(data: T, options?: JsonFormatOptions): void {
  console.log(formatJson(data, options))
}

/**
 * Print a JSON array to stdout.
 */
export function printJsonArray<T>(data: T[], options?: JsonFormatOptions): void {
  console.log(formatJsonArray(data, options))
}

/**
 * Print a success response to stdout.
 */
export function printJsonSuccess<T>(
  data: T,
  meta?: JsonResponse<T>["meta"],
  options?: JsonFormatOptions
): void {
  console.log(formatJsonSuccess(data, meta, options))
}

/**
 * Print a success response with array data to stdout.
 */
export function printJsonArraySuccess<T>(
  data: T[],
  meta?: Omit<NonNullable<JsonResponse<T[]>["meta"]>, "count">,
  options?: JsonFormatOptions
): void {
  console.log(formatJsonArraySuccess(data, meta, options))
}

/**
 * Print an error response to stdout.
 */
export function printJsonError(
  error: string | Error,
  options?: JsonFormatOptions
): void {
  console.log(formatJsonError(error, options))
}
