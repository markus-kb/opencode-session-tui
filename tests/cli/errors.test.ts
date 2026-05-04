/**
 * Tests for CLI error handling module.
 *
 * Verifies error classes, exit helpers, and validation utilities.
 */

import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import {
  ExitCode,
  CLIError,
  UsageError,
  NotFoundError,
  FileOperationError,
  requireConfirmation,
  projectNotFound,
  sessionNotFound,
  messageNotFound,
  withErrorHandling,
} from "../../src/cli/errors"

// ========================
// Exit Code Tests
// ========================

describe("ExitCode", () => {
  it("should have SUCCESS as 0", () => {
    expect(ExitCode.SUCCESS).toBe(0)
  })

  it("should have ERROR as 1", () => {
    expect(ExitCode.ERROR).toBe(1)
  })

  it("should have USAGE_ERROR as 2", () => {
    expect(ExitCode.USAGE_ERROR).toBe(2)
  })

  it("should have NOT_FOUND as 3", () => {
    expect(ExitCode.NOT_FOUND).toBe(3)
  })

  it("should have FILE_ERROR as 4", () => {
    expect(ExitCode.FILE_ERROR).toBe(4)
  })
})

// ========================
// CLIError Tests
// ========================

describe("CLIError", () => {
  it("should create error with default exit code 1", () => {
    const error = new CLIError("Test error")
    expect(error.message).toBe("Test error")
    expect(error.exitCode).toBe(ExitCode.ERROR)
    expect(error.name).toBe("CLIError")
  })

  it("should create error with custom exit code", () => {
    const error = new CLIError("Test error", ExitCode.FILE_ERROR)
    expect(error.message).toBe("Test error")
    expect(error.exitCode).toBe(ExitCode.FILE_ERROR)
  })

  it("should be an instance of Error", () => {
    const error = new CLIError("Test error")
    expect(error instanceof Error).toBe(true)
  })
})

// ========================
// UsageError Tests
// ========================

describe("UsageError", () => {
  it("should create error with exit code 2", () => {
    const error = new UsageError("Missing --yes flag")
    expect(error.message).toBe("Missing --yes flag")
    expect(error.exitCode).toBe(ExitCode.USAGE_ERROR)
    expect(error.name).toBe("UsageError")
  })

  it("should be an instance of CLIError", () => {
    const error = new UsageError("Test error")
    expect(error instanceof CLIError).toBe(true)
  })
})

// ========================
// NotFoundError Tests
// ========================

describe("NotFoundError", () => {
  it("should create error with exit code 3", () => {
    const error = new NotFoundError("Project not found")
    expect(error.message).toBe("Project not found")
    expect(error.exitCode).toBe(ExitCode.NOT_FOUND)
    expect(error.name).toBe("NotFoundError")
  })

  it("should store resource type", () => {
    const error = new NotFoundError("Project not found", "project")
    expect(error.resourceType).toBe("project")
  })

  it("should handle session resource type", () => {
    const error = new NotFoundError("Session not found", "session")
    expect(error.resourceType).toBe("session")
  })

  it("should handle message resource type", () => {
    const error = new NotFoundError("Message not found", "message")
    expect(error.resourceType).toBe("message")
  })

  it("should be an instance of CLIError", () => {
    const error = new NotFoundError("Test error")
    expect(error instanceof CLIError).toBe(true)
  })
})

// ========================
// FileOperationError Tests
// ========================

describe("FileOperationError", () => {
  it("should create error with exit code 4", () => {
    const error = new FileOperationError("Failed to backup")
    expect(error.message).toBe("Failed to backup")
    expect(error.exitCode).toBe(ExitCode.FILE_ERROR)
    expect(error.name).toBe("FileOperationError")
  })

  it("should store operation type - backup", () => {
    const error = new FileOperationError("Backup failed", "backup")
    expect(error.operation).toBe("backup")
  })

  it("should store operation type - delete", () => {
    const error = new FileOperationError("Delete failed", "delete")
    expect(error.operation).toBe("delete")
  })

  it("should store operation type - copy", () => {
    const error = new FileOperationError("Copy failed", "copy")
    expect(error.operation).toBe("copy")
  })

  it("should store operation type - move", () => {
    const error = new FileOperationError("Move failed", "move")
    expect(error.operation).toBe("move")
  })

  it("should store operation type - read", () => {
    const error = new FileOperationError("Read failed", "read")
    expect(error.operation).toBe("read")
  })

  it("should store operation type - write", () => {
    const error = new FileOperationError("Write failed", "write")
    expect(error.operation).toBe("write")
  })

  it("should be an instance of CLIError", () => {
    const error = new FileOperationError("Test error")
    expect(error instanceof CLIError).toBe(true)
  })
})

// ========================
// Validation Helper Tests
// ========================

describe("requireConfirmation", () => {
  it("should not throw when yes is true", () => {
    expect(() => requireConfirmation(true, "Delete project")).not.toThrow()
  })

  it("should throw UsageError when yes is false", () => {
    expect(() => requireConfirmation(false, "Delete project")).toThrow(UsageError)
  })

  it("should include operation name in error message", () => {
    try {
      requireConfirmation(false, "Delete project")
    } catch (error) {
      expect((error as UsageError).message).toContain("Delete project")
      expect((error as UsageError).message).toContain("--yes")
      expect((error as UsageError).message).toContain("--dry-run")
    }
  })
})

describe("projectNotFound", () => {
  it("should throw NotFoundError with project type", () => {
    expect(() => projectNotFound("proj-123")).toThrow(NotFoundError)
  })

  it("should include project ID in message", () => {
    try {
      projectNotFound("proj-123")
    } catch (error) {
      expect((error as NotFoundError).message).toContain("proj-123")
      expect((error as NotFoundError).resourceType).toBe("project")
    }
  })
})

describe("sessionNotFound", () => {
  it("should throw NotFoundError with session type", () => {
    expect(() => sessionNotFound("sess-456")).toThrow(NotFoundError)
  })

  it("should include session ID in message", () => {
    try {
      sessionNotFound("sess-456")
    } catch (error) {
      expect((error as NotFoundError).message).toContain("sess-456")
      expect((error as NotFoundError).resourceType).toBe("session")
    }
  })
})

describe("messageNotFound", () => {
  it("should throw NotFoundError with message type", () => {
    expect(() => messageNotFound("msg-789")).toThrow(NotFoundError)
  })

  it("should include message ID in message", () => {
    try {
      messageNotFound("msg-789")
    } catch (error) {
      expect((error as NotFoundError).message).toContain("msg-789")
      expect((error as NotFoundError).resourceType).toBe("message")
    }
  })
})

// ========================
// withErrorHandling Tests
// ========================

describe("withErrorHandling", () => {
  it("should call the wrapped function with arguments", async () => {
    const mockFn = mock(async (a: number, b: string) => {
      // Do nothing, just verify it's called
    })
    const wrapped = withErrorHandling(mockFn)
    await wrapped(42, "test")
    expect(mockFn).toHaveBeenCalledWith(42, "test")
  })

  it("should not catch errors when function succeeds", async () => {
    let called = false
    const fn = async () => {
      called = true
    }
    const wrapped = withErrorHandling(fn)
    await wrapped()
    expect(called).toBe(true)
  })

  // Note: Testing exit behavior requires mocking process.exit
  // which is complex in bun:test. The exit helpers are tested
  // via integration tests instead.
})

// ========================
// Error Inheritance Tests
// ========================

describe("Error inheritance", () => {
  it("UsageError should be catchable as CLIError", () => {
    const error = new UsageError("Test")
    let caught = false
    try {
      throw error
    } catch (e) {
      if (e instanceof CLIError) {
        caught = true
        expect(e.exitCode).toBe(ExitCode.USAGE_ERROR)
      }
    }
    expect(caught).toBe(true)
  })

  it("NotFoundError should be catchable as CLIError", () => {
    const error = new NotFoundError("Test", "project")
    let caught = false
    try {
      throw error
    } catch (e) {
      if (e instanceof CLIError) {
        caught = true
        expect(e.exitCode).toBe(ExitCode.NOT_FOUND)
      }
    }
    expect(caught).toBe(true)
  })

  it("FileOperationError should be catchable as CLIError", () => {
    const error = new FileOperationError("Test", "backup")
    let caught = false
    try {
      throw error
    } catch (e) {
      if (e instanceof CLIError) {
        caught = true
        expect(e.exitCode).toBe(ExitCode.FILE_ERROR)
      }
    }
    expect(caught).toBe(true)
  })

  it("All CLI errors should be catchable as Error", () => {
    const errors = [
      new CLIError("Test"),
      new UsageError("Test"),
      new NotFoundError("Test"),
      new FileOperationError("Test"),
    ]

    for (const error of errors) {
      let caught = false
      try {
        throw error
      } catch (e) {
        if (e instanceof Error) {
          caught = true
        }
      }
      expect(caught).toBe(true)
    }
  })
})
