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

  it("initialize returns protocolVersion and serverInfo", async () => {
    const { request } = await import("node:http");
    const body = JSON.stringify({ jsonrpc: "2.0", id: 99, method: "initialize", params: {} });
    const parsed = new URL(`${url}/mcp`);
    const j = await new Promise<{ result: { protocolVersion: string; serverInfo: { name: string; version: string }; capabilities: object } }>((resolve, reject) => {
      const req = request({ hostname: parsed.hostname, port: Number(parsed.port), path: "/mcp", method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body), "connection": "close" } }, (res) => {
        let data = "";
        res.on("data", (c: string) => { data += c; });
        res.on("end", () => resolve(JSON.parse(data)));
      });
      req.on("error", reject);
      req.end(body);
    });
    expect(j.result.protocolVersion).toBe("2025-06-18");
    expect(j.result.serverInfo.name).toBe("ide-bridge");
    expect(j.result.capabilities).toHaveProperty("tools");
  });

  it("unknown method returns JSON-RPC error -32601", async () => {
    const r = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "no_such_method" }),
    });
    const j = await r.json() as { error: { code: number; message: string } };
    expect(j.error.code).toBe(-32601);
    expect(j.error.message).toMatch(/not implemented|unknown/i);
  });

  it("tool call with missing project_id returns JSON-RPC -32602, not HTTP 500", async () => {
    const r = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 42, method: "tools/call",
        params: { name: "load_checkpoint", arguments: {} },
      }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { error: { code: number; message: string } };
    expect(j.error.code).toBe(-32602);
    expect(j.error.message).toMatch(/project_id/);
  });

  it("tool call with missing cwd for get_project_id returns JSON-RPC -32602", async () => {
    const r = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 43, method: "tools/call",
        params: { name: "get_project_id", arguments: {} },
      }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { error: { code: number; message: string } };
    expect(j.error.code).toBe(-32602);
    expect(j.error.message).toMatch(/cwd/);
  });
});
