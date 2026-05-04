/**
 * Tests for JSON output formatter.
 */

import { describe, expect, it } from "bun:test"
import {
  formatJson,
  formatJsonArray,
  formatJsonSuccess,
  formatJsonArraySuccess,
  formatJsonError,
  type JsonFormatOptions,
  type JsonResponse,
} from "../../../src/cli/formatters/json"

describe("formatJson", () => {
  it("should format a simple object", () => {
    const data = { name: "test", value: 42 }
    const result = formatJson(data, { pretty: false })
    expect(result).toBe('{"name":"test","value":42}')
  })

  it("should format with pretty printing", () => {
    const data = { name: "test" }
    const result = formatJson(data, { pretty: true, indent: 2 })
    expect(result).toBe('{\n  "name": "test"\n}')
  })

  it("should convert Date objects to ISO strings", () => {
    const date = new Date("2024-01-15T10:30:00.000Z")
    const data = { createdAt: date }
    const result = formatJson(data, { pretty: false })
    expect(result).toBe('{"createdAt":"2024-01-15T10:30:00.000Z"}')
  })

  it("should handle null values", () => {
    const data = { value: null }
    const result = formatJson(data, { pretty: false })
    expect(result).toBe('{"value":null}')
  })

  it("should handle nested objects", () => {
    const data = { outer: { inner: "value" } }
    const result = formatJson(data, { pretty: false })
    expect(result).toBe('{"outer":{"inner":"value"}}')
  })

  it("should handle arrays in objects", () => {
    const data = { items: [1, 2, 3] }
    const result = formatJson(data, { pretty: false })
    expect(result).toBe('{"items":[1,2,3]}')
  })
})

describe("formatJsonArray", () => {
  it("should format an array of objects", () => {
    const data = [{ id: 1 }, { id: 2 }]
    const result = formatJsonArray(data, { pretty: false })
    expect(result).toBe('[{"id":1},{"id":2}]')
  })

  it("should format an empty array", () => {
    const result = formatJsonArray([], { pretty: false })
    expect(result).toBe("[]")
  })

  it("should format with pretty printing", () => {
    const data = [{ id: 1 }]
    const result = formatJsonArray(data, { pretty: true, indent: 2 })
    expect(result).toBe('[\n  {\n    "id": 1\n  }\n]')
  })
})

describe("formatJsonSuccess", () => {
  it("should wrap data in success envelope", () => {
    const data = { name: "test" }
    const result = formatJsonSuccess(data, undefined, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<typeof data>
    expect(parsed.ok).toBe(true)
    expect(parsed.data).toEqual({ name: "test" })
    expect(parsed.error).toBeUndefined()
  })

  it("should include metadata when provided", () => {
    const data = { name: "test" }
    const meta = { count: 10, limit: 100, truncated: false }
    const result = formatJsonSuccess(data, meta, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<typeof data>
    expect(parsed.meta).toEqual(meta)
  })

  it("should omit metadata when not provided", () => {
    const data = { name: "test" }
    const result = formatJsonSuccess(data, undefined, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<typeof data>
    expect(parsed.meta).toBeUndefined()
  })
})

describe("formatJsonArraySuccess", () => {
  it("should wrap array in success envelope with count", () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = formatJsonArraySuccess(data, undefined, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<typeof data>
    expect(parsed.ok).toBe(true)
    expect(parsed.data).toHaveLength(3)
    expect(parsed.meta?.count).toBe(3)
  })

  it("should include additional metadata", () => {
    const data = [{ id: 1 }]
    const meta = { limit: 100, truncated: true }
    const result = formatJsonArraySuccess(data, meta, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<typeof data>
    expect(parsed.meta?.count).toBe(1)
    expect(parsed.meta?.limit).toBe(100)
    expect(parsed.meta?.truncated).toBe(true)
  })

  it("should handle empty arrays", () => {
    const data: { id: number }[] = []
    const result = formatJsonArraySuccess(data, undefined, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<typeof data>
    expect(parsed.ok).toBe(true)
    expect(parsed.data).toEqual([])
    expect(parsed.meta?.count).toBe(0)
  })
})

describe("formatJsonError", () => {
  it("should wrap error message in error envelope", () => {
    const result = formatJsonError("Something went wrong", { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<never>
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toBe("Something went wrong")
    expect(parsed.data).toBeUndefined()
  })

  it("should extract message from Error objects", () => {
    const error = new Error("Test error")
    const result = formatJsonError(error, { pretty: false })
    const parsed = JSON.parse(result) as JsonResponse<never>
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toBe("Test error")
  })
})

describe("ProjectRecord formatting", () => {
  // Test with a structure matching ProjectRecord from opencode-data
  it("should format ProjectRecord-like objects", () => {
    const project = {
      index: 1,
      bucket: "project",
      filePath: "/home/user/.local/share/opencode/project/abc123.json",
      projectId: "abc123",
      worktree: "/home/user/projects/my-app",
      vcs: "git",
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
      state: "present",
    }
    const result = formatJson(project, { pretty: false })
    const parsed = JSON.parse(result)
    expect(parsed.projectId).toBe("abc123")
    expect(parsed.createdAt).toBe("2024-01-10T08:00:00.000Z")
    expect(parsed.state).toBe("present")
  })
})

describe("SessionRecord formatting", () => {
  // Test with a structure matching SessionRecord from opencode-data
  it("should format SessionRecord-like objects", () => {
    const session = {
      index: 0,
      filePath: "/home/user/.local/share/opencode/sessions/abc123/def456.json",
      sessionId: "def456",
      projectId: "abc123",
      directory: "/home/user/projects/my-app",
      title: "Implement feature X",
      version: "1.0.0",
      createdAt: new Date("2024-01-15T09:00:00.000Z"),
      updatedAt: new Date("2024-01-15T10:30:00.000Z"),
    }
    const result = formatJson(session, { pretty: false })
    const parsed = JSON.parse(result)
    expect(parsed.sessionId).toBe("def456")
    expect(parsed.title).toBe("Implement feature X")
    expect(parsed.createdAt).toBe("2024-01-15T09:00:00.000Z")
    expect(parsed.updatedAt).toBe("2024-01-15T10:30:00.000Z")
  })
})

describe("TokenBreakdown formatting", () => {
  // Test with a structure matching TokenBreakdown from opencode-data
  it("should format TokenBreakdown-like objects", () => {
    const tokens = {
      input: 1500,
      output: 800,
      reasoning: 200,
      cacheRead: 500,
      cacheWrite: 100,
      total: 3100,
    }
    const result = formatJson(tokens, { pretty: false })
    const parsed = JSON.parse(result)
    expect(parsed.input).toBe(1500)
    expect(parsed.total).toBe(3100)
  })
})
