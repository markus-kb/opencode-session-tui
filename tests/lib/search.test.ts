/**
 * Tests for src/lib/search.ts
 *
 * Verifies fuzzy search functionality and ordering behavior.
 */

import { describe, expect, it } from "bun:test";
import {
  createSearcher,
  fuzzySearch,
  fuzzySearchItems,
  buildSearchText,
  tokenizedSearch,
  type SearchCandidate,
} from "../../src/lib/search";

// Test fixtures
const sampleCandidates: SearchCandidate<{ id: string; name: string }>[] = [
  { item: { id: "1", name: "Apple" }, searchText: "apple fruit red" },
  { item: { id: "2", name: "Banana" }, searchText: "banana fruit yellow" },
  { item: { id: "3", name: "Cherry" }, searchText: "cherry fruit red small" },
  { item: { id: "4", name: "Apricot" }, searchText: "apricot fruit orange" },
  { item: { id: "5", name: "Blueberry" }, searchText: "blueberry fruit blue small" },
];

describe("createSearcher", () => {
  it("creates a searcher from candidates", () => {
    const searcher = createSearcher(sampleCandidates);
    expect(searcher).toBeDefined();
    expect(typeof searcher.search).toBe("function");
  });

  it("searcher returns results for matching queries", () => {
    const searcher = createSearcher(sampleCandidates);
    const results = searcher.search("apple");
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("fuzzySearch", () => {
  it("returns all items when query is empty", () => {
    const results = fuzzySearch(sampleCandidates, "");
    expect(results.length).toBe(5);
    // All should have score 1
    for (const r of results) {
      expect(r.score).toBe(1);
    }
  });

  it("returns all items when query is whitespace only", () => {
    const results = fuzzySearch(sampleCandidates, "   ");
    expect(results.length).toBe(5);
  });

  it("returns matching items for a valid query", () => {
    const results = fuzzySearch(sampleCandidates, "apple");
    expect(results.length).toBeGreaterThan(0);
    // Apple should be in results
    const appleResult = results.find((r) => r.item.name === "Apple");
    expect(appleResult).toBeDefined();
  });

  it("returns results sorted by score descending", () => {
    const results = fuzzySearch(sampleCandidates, "fruit");
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("ranks exact matches higher than partial matches", () => {
    const results = fuzzySearch(sampleCandidates, "apple");
    // Apple (exact match) should have higher score than Apricot (partial match)
    const appleResult = results.find((r) => r.item.name === "Apple");
    const apricotResult = results.find((r) => r.item.name === "Apricot");

    if (appleResult && apricotResult) {
      expect(appleResult.score).toBeGreaterThan(apricotResult.score);
    }
  });

  it("applies default limit of 200", () => {
    // Create more than 200 candidates
    const manyCandidates: SearchCandidate<{ id: number }>[] = [];
    for (let i = 0; i < 300; i++) {
      manyCandidates.push({
        item: { id: i },
        searchText: `item number ${i}`,
      });
    }

    const results = fuzzySearch(manyCandidates, "item");
    expect(results.length).toBeLessThanOrEqual(200);
  });

  it("respects custom limit option", () => {
    const results = fuzzySearch(sampleCandidates, "fruit", { limit: 2 });
    expect(results.length).toBe(2);
  });

  it("returns fewer than limit when not enough matches", () => {
    const results = fuzzySearch(sampleCandidates, "apple", { limit: 100 });
    expect(results.length).toBeLessThan(100);
  });

  it("finds items by partial word match", () => {
    const results = fuzzySearch(sampleCandidates, "blu");
    const blueberryResult = results.find((r) => r.item.name === "Blueberry");
    expect(blueberryResult).toBeDefined();
  });

  it("finds items across multiple search terms", () => {
    const results = fuzzySearch(sampleCandidates, "red small");
    // Cherry has both "red" and "small" in searchText
    const cherryResult = results.find((r) => r.item.name === "Cherry");
    expect(cherryResult).toBeDefined();
  });
});

describe("fuzzySearchItems", () => {
  it("returns only items without scores", () => {
    const items = fuzzySearchItems(sampleCandidates, "apple");
    expect(items.length).toBeGreaterThan(0);
    // Should be the original item objects
    const appleItem = items.find((item) => item.name === "Apple");
    expect(appleItem).toBeDefined();
    expect(appleItem!.id).toBe("1");
  });

  it("returns all items when query is empty", () => {
    const items = fuzzySearchItems(sampleCandidates, "");
    expect(items.length).toBe(5);
  });

  it("respects limit option", () => {
    const items = fuzzySearchItems(sampleCandidates, "fruit", { limit: 3 });
    expect(items.length).toBe(3);
  });

  it("maintains score-based ordering", () => {
    const items = fuzzySearchItems(sampleCandidates, "apple");
    // Apple should come before Apricot since it's a better match
    const appleIdx = items.findIndex((item) => item.name === "Apple");
    const apricotIdx = items.findIndex((item) => item.name === "Apricot");

    if (appleIdx !== -1 && apricotIdx !== -1) {
      expect(appleIdx).toBeLessThan(apricotIdx);
    }
  });
});

describe("buildSearchText", () => {
  it("joins multiple string fields with spaces", () => {
    const result = buildSearchText("hello", "world");
    expect(result).toBe("hello world");
  });

  it("filters out null values", () => {
    const result = buildSearchText("hello", null, "world");
    expect(result).toBe("hello world");
  });

  it("filters out undefined values", () => {
    const result = buildSearchText("hello", undefined, "world");
    expect(result).toBe("hello world");
  });

  it("filters out empty strings", () => {
    const result = buildSearchText("hello", "", "world");
    expect(result).toBe("hello world");
  });

  it("normalizes multiple whitespace to single space", () => {
    const result = buildSearchText("hello   world", "foo  bar");
    expect(result).toBe("hello world foo bar");
  });

  it("trims leading and trailing whitespace", () => {
    const result = buildSearchText("  hello  ", "  world  ");
    expect(result).toBe("hello world");
  });

  it("returns empty string when all fields are null/undefined", () => {
    const result = buildSearchText(null, undefined, "");
    expect(result).toBe("");
  });

  it("handles single field", () => {
    const result = buildSearchText("single");
    expect(result).toBe("single");
  });

  it("handles no fields", () => {
    const result = buildSearchText();
    expect(result).toBe("");
  });
});

describe("fuzzySearch ordering behavior", () => {
  // Mimics TUI session search behavior
  const sessionCandidates: SearchCandidate<{
    id: string;
    title: string;
    updatedAt: number;
    createdAt: number;
  }>[] = [
    {
      item: { id: "sess_1", title: "Bug fix authentication", updatedAt: 1000, createdAt: 900 },
      searchText: "Bug fix authentication sess_1",
    },
    {
      item: { id: "sess_2", title: "Feature authentication", updatedAt: 2000, createdAt: 800 },
      searchText: "Feature authentication sess_2",
    },
    {
      item: { id: "sess_3", title: "Auth refactor", updatedAt: 500, createdAt: 700 },
      searchText: "Auth refactor sess_3",
    },
    {
      item: { id: "sess_4", title: "Unrelated task", updatedAt: 3000, createdAt: 600 },
      searchText: "Unrelated task sess_4",
    },
  ];

  it("matches partial terms in session-like data", () => {
    const results = fuzzySearch(sessionCandidates, "auth");
    // Should match at least 3 items containing "auth" or "authentication"
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("prioritizes better matches over timestamp when searching", () => {
    const results = fuzzySearch(sessionCandidates, "authentication");
    // Items with "authentication" should rank higher than "Auth refactor"
    const authItems = results.filter(
      (r) =>
        r.item.title === "Bug fix authentication" || r.item.title === "Feature authentication"
    );
    const refactorItem = results.find((r) => r.item.title === "Auth refactor");

    if (authItems.length > 0 && refactorItem) {
      const authScores = authItems.map((r) => r.score);
      const minAuthScore = Math.min(...authScores);
      expect(minAuthScore).toBeGreaterThan(refactorItem.score);
    }
  });

  it("returns empty results for non-matching queries", () => {
    const results = fuzzySearch(sessionCandidates, "xyz123nonexistent");
    expect(results.length).toBe(0);
  });

  it("searches by session ID", () => {
    const results = fuzzySearch(sessionCandidates, "sess_3");
    expect(results.length).toBeGreaterThan(0);
    const sess3 = results.find((r) => r.item.id === "sess_3");
    expect(sess3).toBeDefined();
  });
});

// Project-like data for tokenized search tests
type ProjectLike = {
  projectId: string;
  worktree: string;
  state: "exists" | "missing";
};

const projectData: ProjectLike[] = [
  { projectId: "proj_abc123", worktree: "/home/user/projects/my-app", state: "exists" },
  { projectId: "proj_def456", worktree: "/home/user/projects/api-server", state: "exists" },
  { projectId: "proj_ghi789", worktree: "/home/user/work/frontend-app", state: "missing" },
  { projectId: "proj_jkl012", worktree: "/var/www/website", state: "exists" },
  { projectId: "proj_mno345", worktree: "/home/user/projects/cli-tool", state: "exists" },
];

describe("tokenizedSearch", () => {
  const getFields = (p: ProjectLike) => [p.projectId, p.worktree];

  it("returns all items when query is empty", () => {
    const results = tokenizedSearch(projectData, "", getFields);
    expect(results.length).toBe(5);
  });

  it("returns all items when query is whitespace only", () => {
    const results = tokenizedSearch(projectData, "   ", getFields);
    expect(results.length).toBe(5);
  });

  it("matches single token in projectId", () => {
    const results = tokenizedSearch(projectData, "abc123", getFields);
    expect(results.length).toBe(1);
    expect(results[0].projectId).toBe("proj_abc123");
  });

  it("matches single token in worktree", () => {
    const results = tokenizedSearch(projectData, "api-server", getFields);
    expect(results.length).toBe(1);
    expect(results[0].worktree).toBe("/home/user/projects/api-server");
  });

  it("matches partial substring", () => {
    const results = tokenizedSearch(projectData, "proj", getFields);
    // All items have "proj" in projectId or worktree path
    expect(results.length).toBe(5);
  });

  it("requires all tokens to match (AND logic)", () => {
    // Both tokens must match somewhere in the fields
    const results = tokenizedSearch(projectData, "abc 123", getFields);
    expect(results.length).toBe(1);
    expect(results[0].projectId).toBe("proj_abc123");
  });

  it("allows tokens to match different fields", () => {
    // "proj" in projectId, "app" in worktree path
    const results = tokenizedSearch(projectData, "proj app", getFields);
    // Should match: my-app, frontend-app
    expect(results.length).toBe(2);
    const paths = results.map((r) => r.worktree);
    expect(paths).toContain("/home/user/projects/my-app");
    expect(paths).toContain("/home/user/work/frontend-app");
  });

  it("is case insensitive", () => {
    const results = tokenizedSearch(projectData, "ABC123", getFields);
    expect(results.length).toBe(1);
    expect(results[0].projectId).toBe("proj_abc123");
  });

  it("handles mixed case query", () => {
    const results = tokenizedSearch(projectData, "USER Projects", getFields);
    // Matches items with /home/user/projects in path
    expect(results.length).toBe(3);
  });

  it("returns no matches when token is not found", () => {
    const results = tokenizedSearch(projectData, "nonexistent", getFields);
    expect(results.length).toBe(0);
  });

  it("returns no matches when any token fails to match", () => {
    // "abc123" matches, but "nonexistent" does not
    const results = tokenizedSearch(projectData, "abc123 nonexistent", getFields);
    expect(results.length).toBe(0);
  });

  it("applies default limit of 200", () => {
    const manyProjects: ProjectLike[] = [];
    for (let i = 0; i < 300; i++) {
      manyProjects.push({
        projectId: `proj_${i}`,
        worktree: `/path/to/project${i}`,
        state: "exists",
      });
    }

    const results = tokenizedSearch(manyProjects, "proj", getFields);
    expect(results.length).toBe(200);
  });

  it("respects custom limit option", () => {
    const results = tokenizedSearch(projectData, "proj", getFields, { limit: 2 });
    expect(results.length).toBe(2);
  });

  it("handles null and undefined in fields", () => {
    const dataWithNulls: ProjectLike[] = [
      { projectId: "proj_test", worktree: "/path/to/test", state: "exists" },
    ];
    // getFields returns array that could have nulls
    const getFieldsWithNulls = (p: ProjectLike) => [p.projectId, null, undefined, p.worktree];
    const results = tokenizedSearch(dataWithNulls, "test", getFieldsWithNulls);
    expect(results.length).toBe(1);
  });

  it("preserves original order of items", () => {
    const results = tokenizedSearch(projectData, "proj", getFields, { limit: 5 });
    // Items should be in original array order
    expect(results[0].projectId).toBe("proj_abc123");
    expect(results[4].projectId).toBe("proj_mno345");
  });

  it("handles query with extra whitespace", () => {
    const results = tokenizedSearch(projectData, "  abc   123  ", getFields);
    expect(results.length).toBe(1);
    expect(results[0].projectId).toBe("proj_abc123");
  });

  it("matches TUI project search semantics", () => {
    // This test verifies the exact TUI behavior:
    // 1. Split query on whitespace
    // 2. Each token must be found in projectId OR worktree
    // 3. Case-insensitive substring matching
    
    // Search for "user cli" should match proj_mno345 (/home/user/projects/cli-tool)
    const results = tokenizedSearch(projectData, "user cli", getFields);
    expect(results.length).toBe(1);
    expect(results[0].projectId).toBe("proj_mno345");
  });
});
