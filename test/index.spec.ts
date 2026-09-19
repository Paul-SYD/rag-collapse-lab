import { describe, it, expect } from "vitest";
import { chunkText } from "../src/index";

describe("chunkText", () => {
  it("splits a single short paragraph into one chunk", () => {
    const text = "This is a short paragraph about firewalls and network security.";
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("firewalls");
  });

  it("splits multiple paragraphs into separate chunks when exceeding max size", () => {
    const paragraph = "A".repeat(300);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("filters out very short fragments (noise) below the minimum paragraph length", () => {
    const text = "Hi\n\nOk\n\nThis is an actual real paragraph with enough content to be kept.";
    const chunks = chunkText(text, 500);
    // Short 2-3 char fragments should be filtered by the >20 char paragraph check
    expect(chunks.every(c => c.length > 20)).toBe(true);
  });

  it("returns an empty array for empty input", () => {
    const chunks = chunkText("", 500);
    expect(chunks.length).toBe(0);
  });
});
