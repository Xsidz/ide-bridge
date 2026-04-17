import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildToolHandlers } from "../../src/mcp/tools.js";
import { FileBundleStore } from "../../src/store/file_store.js";
import { Debouncer } from "../../src/debounce.js";
import { AdapterRegistry } from "../../src/adapters/types.js";

beforeEach(() => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-large-"));
});

describe("stress: large PCB round-trip", () => {
  it("1000 todos + 500 decisions serialize and deserialize correctly under 1000 ms", async () => {
    const h = buildToolHandlers({
      store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry(),
    });
    const todos = Array.from({ length: 1000 }, (_, i) => ({ id: `t_${i}`, text: `todo ${i}`, status: "pending" as const }));
    const decisions = Array.from({ length: 500 }, (_, i) => ({ id: `d_${i}`, at: new Date().toISOString(), text: `decision ${i}` }));
    const start = Date.now();
    await h.save_checkpoint({ project_id: "bigproj", source_ide: "claude-code",
      bundle_patch: { todos, decisions }, force: true });
    const { bundle } = await h.load_checkpoint({ project_id: "bigproj" });
    const elapsed = Date.now() - start;
    expect(bundle!.todos.length).toBe(1000);
    expect(bundle!.decisions.length).toBe(500);
    expect(bundle!.todos[999]!.text).toBe("todo 999");
    expect(elapsed).toBeLessThan(1000);
  });
});
