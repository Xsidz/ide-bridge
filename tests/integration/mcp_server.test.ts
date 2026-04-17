import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";

let stop: () => Promise<void>;
let url: string;

beforeEach(async () => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-mcp-"));
  const s = await startMcpServer({ port: 0 });
  stop = s.stop; url = s.url;
});
afterEach(async () => stop());

describe("MCP HTTP server", () => {
  it("lists 6 tools", async () => {
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    const r = await fetch(`${url}/mcp`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json() as { result: { tools: Array<{ name: string }> } };
    expect(j.result.tools.map(t => t.name).sort()).toEqual(
      ["append_decision", "append_todo", "get_project_id", "list_projects", "load_checkpoint", "save_checkpoint"]
    );
  });
  it("save_checkpoint + load_checkpoint round-trips via tool call", async () => {
    await fetch(`${url}/mcp`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "save_checkpoint",
          arguments: { project_id: "p", source_ide: "claude-code",
            bundle_patch: { plan: { summary: "hi", current_step: null, steps: [] } } } } }) });
    const r = await fetch(`${url}/mcp`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: "load_checkpoint", arguments: { project_id: "p" } } }) });
    const j = await r.json() as { result: { content: Array<{ text: string }> } };
    const parsed = JSON.parse(j.result.content[0]!.text);
    expect(parsed.bundle.plan.summary).toBe("hi");
  });
});
