import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildToolHandlers } from "../../src/mcp/tools.js";
import { FileBundleStore } from "../../src/store/file_store.js";
import { Debouncer } from "../../src/debounce.js";
import { AdapterRegistry } from "../../src/adapters/types.js";

beforeEach(() => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-stress-"));
});

describe("stress: concurrent saves same project", () => {
  it("final bundle is uncorrupted; history has 50 entries", async () => {
    const h = buildToolHandlers({
      store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry(),
    });
    const N = 50;
    const summaries = Array.from({ length: N }, (_, i) => `summary-${i}`);
    // With per-save unique tmp filenames, all saves should succeed
    const results = await Promise.all(
      summaries.map((s, i) =>
        h.save_checkpoint({ project_id: "proj", source_ide: "claude-code",
          bundle_patch: { plan: { summary: s, current_step: null, steps: [] } }, force: true })
      )
    );
    expect(results.every(r => r.saved)).toBe(true);
    const { bundle } = await h.load_checkpoint({ project_id: "proj" });
    expect(bundle).not.toBeNull();
    expect(summaries).toContain(bundle!.plan.summary);
    const store = new FileBundleStore();
    const history = await store.listHistory("proj");
    expect(history.length).toBe(N);
  });
});
