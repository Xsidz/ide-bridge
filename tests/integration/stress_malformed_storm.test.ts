import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";

let stop: () => Promise<void>;
let url: string;

beforeEach(async () => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-storm-"));
  const s = await startMcpServer({ port: 0 });
  stop = s.stop; url = s.url;
});
afterEach(async () => stop());

describe("stress: malformed payload storm", () => {
  it("100 broken-JSON requests: server survives and responds to a good request after", async () => {
    const bad = Array.from({ length: 100 }, (_, i) =>
      fetch(`${url}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `{ "jsonrpc": "2.0", "id": ${i}, BROKEN`,
      }).then(r => r.status)
    );
    const statuses = await Promise.all(bad);
    expect(statuses.every(s => s >= 400)).toBe(true);
    const r = await fetch(`${url}/mcp`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 999, method: "tools/list" }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { result: { tools: unknown[] } };
    expect(j.result.tools.length).toBeGreaterThan(0);
  });
});
