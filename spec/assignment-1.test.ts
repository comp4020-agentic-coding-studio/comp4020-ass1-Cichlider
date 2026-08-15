import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Assignment 1's own contract, on top of the shared invariants.
// Spec: https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/
//
// Deployment, static/client-side, and process evidence are already covered by
// invariants.test.ts, the build/deploy CI jobs, and `pnpm check:evidence` —
// no new test needed for those. Viewport behaviour and "one idea, nothing
// else" are judged live at the crit, not by a static DOM check.
//
// This file only covers the core interaction: it must change what the
// visitor sees, and it must be testable. A static parse of the built HTML
// can't prove clicking *works*, but it can prove the interaction's markup
// contract exists — replace these testids if the design changes.

const distPath = resolve("dist/index.html");

describe("assignment 1: core interaction", () => {
  it("built the page", () => {
    expect(existsSync(distPath)).toBe(true);
  });

  const doc = existsSync(distPath)
    ? new JSDOM(readFileSync(distPath, "utf8")).window.document
    : undefined;

  it("has a trigger for the core interaction", () => {
    expect(
      doc?.querySelector('[data-testid="explode-trigger"]'),
      "No element with data-testid=\"explode-trigger\" — this is the thing the visitor clicks to explode the model. Add the attribute to whatever element does that.",
    ).toBeTruthy();
  });

  it("has a place the result of that interaction shows up", () => {
    expect(
      doc?.querySelector('[data-testid="part-info"]'),
      "No element with data-testid=\"part-info\" — this is where the selected part's info should appear after the visitor interacts. Add the attribute to that panel.",
    ).toBeTruthy();
  });
});
