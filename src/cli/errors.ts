/**
 * CLI error handling module.
 *
 * Provides standardized error classes and exit helpers for consistent
 * error handling across all CLI commands.
 *
 * Exit codes:
 * - 0: Success
 * - 1: General error (unspecified)
 * - 2: Usage error (e.g., missing --yes for destructive operations)
 * - 3: Missing resource (e.g., invalid project/session ID)
 * - 4: File operation failure (e.g., backup failed, delete failed)
 */

import { formatErrorOutput, type OutputFormat } from "./output"

// ========================
// Exit Codes
// ========================

/**
 * Standardized CLI exit codes.
 */
export const ExitCode = {
  /** Success */
  SUCCESS: 0,
  /** General error (unspecified) */
  ERROR: 1,
  /** Usage error (e.g., missing --yes for destructive operations) */
  USAGE_ERROR: 2,
  /** Missing resource (e.g., invalid project/session ID) */
  NOT_FOUND: 3,
  /** File operation failure (e.g., backup failed, delete failed) */
  FILE_ERROR: 4,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

// ========================
// Error Classes
// ========================

/**
 * Base class for CLI errors with exit codes.
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCodeValue = ExitCode.ERROR
  ) {
    super(message)
    this.name = "CLIError"
  }
}

/**
 * Usage error (exit code 2).
 * Thrown when CLI usage is incorrect, such as missing required confirmation.
 */
export class UsageError extends CLIError {
  constructor(message: string) {
    super(message, ExitCode.USAGE_ERROR)
    this.name = "UsageError"
  }
}

/**
 * Not found error (exit code 3).
 * Thrown when a requested resource (project, session, message) doesn't exist.
 */
export class NotFoundError extends CLIError {
  constructor(
    message: string,
    public readonly resourceType?: "project" | "session" | "message"
  ) {
    super(message, ExitCode.NOT_FOUND)
    this.name = "NotFoundError"
  }
}

/**
 * File operation error (exit code 4).
 * Thrown when a file system operation fails (backup, delete, copy, move).
 */
export class FileOperationError extends CLIError {
  constructor(
    message: string,
    public readonly operation?: "backup" | "delete" | "copy" | "move" | "read" | "write"
  ) {
    super(message, ExitCode.FILE_ERROR)
    this.name = "FileOperationError"
  }
}

// ========================
// Exit Helpers
// ========================

/**
 * Exit the process with a formatted error message.
 *
 * @param error - Error message or Error object
 * @param exitCode - Exit code (defaults to 1)
 * @param format - Output format for error message
 */
export function exitWithError(
  error: string | Error,
  exitCode: ExitCodeValue = ExitCode.ERROR,
  format: OutputFormat = "table"
): never {
  console.error(formatErrorOutput(error, format))
  process.exit(exitCode)
}

/**
 * Exit the process with a CLIError, using its exit code.
 *
 * @param error - CLIError instance
 * @param format - Output format for error message
 */
export function exitWithCLIError(
  error: CLIError,
  format: OutputFormat = "table"
): never {
  console.error(formatErrorOutput(error, format))
  process.exit(error.exitCode)
}

/**
 * Exit with a usage error (exit code 2).
 *
 * @param message - Error message
 * @param format - Output format
 */
export function exitUsageError(
  message: string,
  format: OutputFormat = "table"
): never {
  exitWithError(message, ExitCode.USAGE_ERROR, format)
}

/**
 * Exit with a not found error (exit code 3).
 *
 * @param message - Error message
 * @param format - Output format
 */
export function exitNotFound(
  message: string,
  format: OutputFormat = "table"
): never {
  exitWithError(message, ExitCode.NOT_FOUND, format)
}

/**
 * Exit with a file operation error (exit code 4).
 *
 * @param message - Error message
 * @param format - Output format
 */
export function exitFileError(
  message: string,
  format: OutputFormat = "table"
): never {
  exitWithError(message, ExitCode.FILE_ERROR, format)
}

// ========================
// Error Handling Utilities
// ========================

/**
 * Handle an error by exiting with the appropriate code.
 * Recognizes CLIError subclasses and uses their exit codes.
 *
 * @param error - Error to handle
 * @param format - Output format
 */
export function handleError(
  error: unknown,
  format: OutputFormat = "table"
): never {
  if (error instanceof CLIError) {
    exitWithCLIError(error, format)
  }

  if (error instanceof Error) {
    exitWithError(error.message, ExitCode.ERROR, format)
  }

  exitWithError(String(error), ExitCode.ERROR, format)
}

/**
 * Wrap an async function to catch errors and exit appropriately.
 * Use this to wrap command handlers.
 *
 * @param fn - Async function to wrap
 * @param format - Output format for errors
 * @returns Wrapped function that handles errors
 */
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  format: OutputFormat = "table"
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args)
    } catch (error) {
      handleError(error, format)
    }
  }
}

// ========================
// Validation Helpers
// ========================

/**
 * Require confirmation for destructive operations.
 * Throws UsageError if --yes flag is not provided.
 *
 * @param yes - Whether --yes flag was provided
 * @param operation - Description of the operation for error message
 */
export function requireConfirmation(yes: boolean, operation: string): void {
  if (!yes) {
    throw new UsageError(
      `${operation} requires --yes flag to confirm. Use --dry-run to preview changes.`
    )
  }
}

/**
 * Throw NotFoundError for a project.
 *
 * @param projectId - The project ID that wasn't found
 */
export function projectNotFound(projectId: string): never {
  throw new NotFoundError(`Project not found: ${projectId}`, "project")
}

/**
 * Throw NotFoundError for a session.
 *
 * @param sessionId - The session ID that wasn't found
 */
export function sessionNotFound(sessionId: string): never {
  throw new NotFoundError(`Session not found: ${sessionId}`, "session")
}

/**
 * Throw NotFoundError for a message.
 *
 * @param messageId - The message ID that wasn't found
 */
export function messageNotFound(messageId: string): never {
  throw new NotFoundError(`Message not found: ${messageId}`, "message")
}
