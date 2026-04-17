import { describe, it, expect, vi } from "vitest";
import { Debouncer } from "../../src/debounce.js";

describe("Debouncer", () => {
  it("allows first save, blocks second within window", () => {
    vi.useFakeTimers();
    const d = new Debouncer(30_000);
    expect(d.shouldSave("p")).toBe(true);
    d.mark("p");
    expect(d.shouldSave("p")).toBe(false);
    vi.advanceTimersByTime(29_999);
    expect(d.shouldSave("p")).toBe(false);
    vi.advanceTimersByTime(2);
    expect(d.shouldSave("p")).toBe(true);
    vi.useRealTimers();
  });
  it("is per-project", () => {
    const d = new Debouncer(30_000);
    d.mark("a");
    expect(d.shouldSave("b")).toBe(true);
  });
});
