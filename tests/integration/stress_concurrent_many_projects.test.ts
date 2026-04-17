import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildToolHandlers } from "../../src/mcp/tools.js";
import { FileBundleStore } from "../../src/store/file_store.js";
import { Debouncer } from "../../src/debounce.js";
import { AdapterRegistry } from "../../src/adapters/types.js";

beforeEach(() => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-multi-"));
});

describe("stress: many projects no cross-contamination", () => {
  it("each project's bundle contains only its own project_id", async () => {
    const h = buildToolHandlers({
      store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry(),
    });
    const PROJECTS = 20;
    const SAVES_EACH = 5;
    const results = await Promise.all(
      Array.from({ length: PROJECTS }, (_, p) =>
        Array.from({ length: SAVES_EACH }, (_, s) =>
          h.save_checkpoint({ project_id: `proj-${p}`, source_ide: "claude-code",
            bundle_patch: { plan: { summary: `p${p}-s${s}`, current_step: null, steps: [] } }, force: true })
        )
      ).flat()
    );
    expect(results.every(r => r.saved)).toBe(true);
    await Promise.all(
      Array.from({ length: PROJECTS }, async (_, p) => {
        const { bundle } = await h.load_checkpoint({ project_id: `proj-${p}` });
        expect(bundle!.project.id).toBe(`proj-${p}`);
        expect(bundle!.plan.summary).toMatch(new RegExp(`^p${p}-`));
      })
    );
  });
});
