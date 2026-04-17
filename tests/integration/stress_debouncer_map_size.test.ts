import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Debouncer } from "../../src/debounce.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("stress: debouncer map size", () => {
  it("10,000 distinct project_ids leave Map at exactly 10,000", () => {
    const d = new Debouncer(30_000);
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      d.shouldSave(`proj-${i}`);
      d.mark(`proj-${i}`);
    }
    const map = (d as unknown as { last: Map<string, number> }).last;
    expect(map.size).toBe(N);
  });

  it("repeated marks on the same key do not grow the Map", () => {
    const d = new Debouncer(30_000);
    for (let i = 0; i < 500; i++) d.mark("same-key");
    const map = (d as unknown as { last: Map<string, number> }).last;
    expect(map.size).toBe(1);
  });
});
