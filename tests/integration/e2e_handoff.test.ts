import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";
import { claudeCodeAdapter } from "../../src/adapters/claude_code.js";
import { cursorAdapter } from "../../src/adapters/cursor.js";
import { emptyPcb } from "../../src/pcb/schema.js";

let stop: () => Promise<void>;
let url: string;
let home: string;
let projectRoot: string;

beforeEach(async () => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-e2e-"));
  process.env.IDE_BRIDGE_HOME = home;
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-e2e-p-"));
  const s = await startMcpServer({ port: 0 });
  stop = s.stop; url = s.url;
});
afterEach(async () => stop());

async function call<T>(name: string, args: unknown): Promise<T> {
  const r = await fetch(`${url}/mcp`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
  const j = await r.json() as { result: { content: Array<{ text: string }> } };
  return JSON.parse(j.result.content[0]!.text) as T;
}

describe("e2e handoff", () => {
  it("Claude Code -> Cursor: plan + decision + todo travel end to end", async () => {
    await call("save_checkpoint", { project_id: "p", source_ide: "claude-code",
      bundle_patch: { plan: { summary: "Implement Stripe webhook", current_step: "sig verify", steps: [] } } });
    await call("append_decision", { project_id: "p", text: "Use raw body + HMAC-SHA256", rationale: "Stripe spec requires raw body" });
    await call("append_todo", { project_id: "p", text: "Write replay-attack test" });

    const { bundle } = await call<{ bundle: ReturnType<typeof emptyPcb> }>("load_checkpoint", { project_id: "p" });
    expect(bundle.plan.summary).toBe("Implement Stripe webhook");
    expect(bundle.decisions[0]!.text).toMatch(/HMAC/);
    expect(bundle.todos[0]!.text).toMatch(/replay/);

    await cursorAdapter.import_into(projectRoot, bundle);
    const primer = readFileSync(path.join(projectRoot, ".cursor", "rules", "_imported.mdc"), "utf8");
    expect(primer).toMatch(/Stripe webhook/);
    expect(primer).toMatch(/HMAC|Decisions/);
  });

  it("Claude Code L3 round trip: extract -> bundle -> forged-session import", async () => {
    process.env.HOME = home;
    // Use the real dash-encoding that Claude Code actually uses:
    const encoded = projectRoot.replace(/[/._]/g, "-");
    const sessionDir = path.join(home, ".claude", "projects", encoded);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionDir, "src.jsonl"),
      `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"hi"}]},"timestamp":"2026-04-17T00:00:00Z","uuid":"x"}\n`
    );

    const extracted = await claudeCodeAdapter.extract(projectRoot);
    expect(extracted.conversation?.last_n_turns?.length).toBe(1);

    const pcb = emptyPcb("p", "claude-code");
    const merged = { ...pcb, conversation: extracted.conversation! };
    const report = await claudeCodeAdapter.import_into(projectRoot, merged);
    expect(report.notes.some(n => n.includes("claude --resume"))).toBe(true);
  });
});
