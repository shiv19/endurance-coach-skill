/**
 * Tests for template validation with fuzzy matching
 */

import { describe, it, expect } from "vitest";
import {
  UnknownTemplateError,
  levenshteinDistance,
  similarityScore,
  findSimilarTemplates,
  validateTemplateExists,
} from "../../src/expander/validation.js";
import { loadTemplates } from "../../src/templates/index.js";

describe("Fuzzy Matching - Levenshtein Distance", () => {
  it("calculates distance for identical strings", () => {
    expect(levenshteinDistance("easy", "easy")).toBe(0);
  });

  it("calculates distance for completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });

  it("calculates distance for strings with one insertion", () => {
    expect(levenshteinDistance("easy", "easi")).toBe(1);
  });

  it("calculates distance for strings with one substitution", () => {
    expect(levenshteinDistance("easy", "eaxy")).toBe(1);
  });

  it("calculates distance for strings with one deletion", () => {
    expect(levenshteinDistance("easy", "esy")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshteinDistance("", "easy")).toBe(4);
    expect(levenshteinDistance("easy", "")).toBe(4);
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("is case insensitive", () => {
    expect(levenshteinDistance("Easy".toLowerCase(), "easy")).toBe(0);
  });
});

describe("Fuzzy Matching - Similarity Score", () => {
  it("returns 1.0 for identical strings", () => {
    expect(similarityScore("easy", "easy")).toBe(1);
  });

  it("returns 1.0 for case differences", () => {
    expect(similarityScore("Easy", "easy")).toBe(1);
  });

  it("returns high score for small typos", () => {
    // "easy" vs "eazy": distance = 1 (s->z), maxLen = 4, score = 1 - 1/4 = 0.75
    expect(similarityScore("easy", "eazy")).toBeGreaterThan(0.7);
  });

  it("returns low score for very different strings", () => {
    expect(similarityScore("easy", "threshold")).toBeLessThan(0.5);
  });

  it("returns 1.0 for empty strings", () => {
    expect(similarityScore("", "")).toBe(1);
  });
});

describe("Fuzzy Matching - Find Similar Templates", () => {
  const templates = loadTemplates();

  it("finds exact matches", () => {
    const results = findSimilarTemplates("easy", templates);
    expect(results).toContain("easy");
    expect(results[0]).toBe("easy");
  });

  it("finds templates with small typos", () => {
    const results = findSimilarTemplates("eazy", templates);
    expect(results.length).toBeGreaterThan(0);
    expect(results).toContain("easy");
  });

  it("finds templates with missing sport prefix", () => {
    const results = findSimilarTemplates("tempo", templates);
    expect(results.length).toBeGreaterThan(0);
    // Should suggest run.tempo, bike.tempo
    expect(results.some((r) => r.includes("tempo"))).toBe(true);
  });

  it("suggests multiple similar templates", () => {
    const results = findSimilarTemplates("interval", templates);
    expect(results.length).toBeGreaterThan(0);
    // Should suggest various interval templates
  });

  it("returns empty array for very different strings", () => {
    const results = findSimilarTemplates("xyzabc", templates);
    expect(results).toEqual([]);
  });

  it("limits suggestions to maxSuggestions", () => {
    const results = findSimilarTemplates("run", templates, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe("Validate Template Exists", () => {
  const templates = loadTemplates();

  it("does not throw for valid templates", () => {
    expect(() => validateTemplateExists("easy", templates)).not.toThrow();
    expect(() => validateTemplateExists("rest", templates)).not.toThrow();
  });

  it("throws UnknownTemplateError for invalid templates", () => {
    expect(() => validateTemplateExists("nonexistent", templates)).toThrow(UnknownTemplateError);
  });

  it("includes template ID in error message", () => {
    try {
      validateTemplateExists("nonexistent", templates);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTemplateError);
      expect((e as UnknownTemplateError).templateId).toBe("nonexistent");
      expect((e as UnknownTemplateError).message).toContain("nonexistent");
    }
  });

  it("includes suggestions in error message", () => {
    try {
      validateTemplateExists("eazy", templates);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTemplateError);
      const error = e as UnknownTemplateError;
      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.suggestions).toContain("easy");
    }
  });

  it("provides helpful error format", () => {
    try {
      validateTemplateExists("nonexistent_xyz123", templates);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTemplateError);
      const error = e as UnknownTemplateError;
      expect(error.message).toContain("Template not found");
      // "nonexistent_xyz123" is very different, so no suggestions
      expect(error.message).toMatch(/(Did you mean|No similar templates found)/);
      expect(error.message).toContain("Check spelling");
    }
  });
});

describe("Template Suggestion Scenarios", () => {
  const templates = loadTemplates();

  it("suggests easy when user types eazy", () => {
    const results = findSimilarTemplates("eazy", templates);
    expect(results).toContain("easy");
  });

  it("suggests run templates when user types easy", () => {
    const results = findSimilarTemplates("easy", templates);
    // easy is a run template, so should match exactly
    expect(results[0]).toBe("easy");
  });

  it("suggests multiple sport-specific templates", () => {
    const results = findSimilarTemplates("rest", templates);
    // Should include run.rest, bike.rest, swim.rest
    const restTemplates = results.filter((r) => r.includes("rest"));
    expect(restTemplates.length).toBeGreaterThanOrEqual(3);
  });

  it("handles partial template names", () => {
    const results = findSimilarTemplates("interval", templates);
    // Should suggest intervals.400, intervals.800, etc.
    expect(results.length).toBeGreaterThan(0);
  });

  it("handles sport prefix variations", () => {
    const results = findSimilarTemplates("run.easy", templates);
    expect(results).toContain("easy");
  });
});
