import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildToolHandlers } from "../../src/mcp/tools.js";
import { FileBundleStore } from "../../src/store/file_store.js";
import { Debouncer } from "../../src/debounce.js";
import { AdapterRegistry } from "../../src/adapters/types.js";

beforeEach(() => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-debounce-"));
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("stress: debouncer under rapid fire", () => {
  it("only the first of 100 attempts saves within the window", async () => {
    const h = buildToolHandlers({
      store: new FileBundleStore(), debouncer: new Debouncer(30_000), adapters: new AdapterRegistry(),
    });
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(await h.save_checkpoint({
        project_id: "hotproj", source_ide: "claude-code",
        bundle_patch: { plan: { summary: `save-${i}`, current_step: null, steps: [] } },
      }));
    }
    const saved = results.filter(r => r.saved);
    expect(saved.length).toBe(1);
    expect(results[0]!.saved).toBe(true);
    vi.advanceTimersByTime(30_001);
    const afterWindow = await h.save_checkpoint({
      project_id: "hotproj", source_ide: "claude-code", bundle_patch: {},
    });
    expect(afterWindow.saved).toBe(true);
  });
});
