import fs from "node:fs/promises";
import { configPath } from "../util/paths.js";
import { resolveProjectId } from "../identity/resolver.js";

export async function cmdHookSave(opts: { projectDir?: string }) {
  const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
  const cwd = opts.projectDir ?? process.cwd();
  const resolved = await resolveProjectId(cwd);
  const url = `http://127.0.0.1:${cfg.port}/mcp`;
  const body = { jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "save_checkpoint", arguments: {
      project_id: resolved.id, source_ide: "claude-code", bundle_patch: {} } } };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  process.stdout.write(JSON.stringify((j as { result: unknown }).result) + "\n");
}

export async function cmdHookLoad(opts: { projectDir?: string }): Promise<void> {
  try {
    const cfgRaw = await fs.readFile(configPath(), "utf8");
    const cfg = JSON.parse(cfgRaw);
    if (!cfg?.port) return; // silent
    const cwd = opts.projectDir ?? process.cwd();
    const resolved = await resolveProjectId(cwd);
    const url = `http://127.0.0.1:${cfg.port}/mcp`;
    const body = {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "load_checkpoint", arguments: { project_id: resolved.id } },
    };
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { result?: { content: Array<{ text: string }> } };
    const payload = JSON.parse(j.result?.content?.[0]?.text ?? "{}") as { bundle?: unknown };
    const bundle = payload.bundle as {
      last_source_ide: string;
      plan: { summary: string; current_step: string | null };
      decisions: Array<{ text: string }>;
      todos: Array<{ text: string; status: string }>;
      conversation: { summary: string };
    } | null;
    if (!bundle) return; // no prior bundle — silent
    const openTodos = bundle.todos.filter(t => t.status !== "done");
    const lines: string[] = [];
    lines.push(`[ide-bridge] Resumed project "${resolved.id}" (last source: ${bundle.last_source_ide})`);
    if (bundle.plan.summary) {
      lines.push(`Plan: ${bundle.plan.summary}${bundle.plan.current_step ? ` — now: ${bundle.plan.current_step}` : ""}`);
    }
    if (bundle.decisions.length) {
      lines.push(`Recent decisions:`);
      for (const d of bundle.decisions.slice(-5)) lines.push(`  - ${d.text}`);
    }
    if (openTodos.length) {
      lines.push(`Open TODOs:`);
      for (const t of openTodos.slice(0, 10)) lines.push(`  - [ ] ${t.text}`);
    }
    if (bundle.conversation.summary) {
      lines.push(`Summary: ${bundle.conversation.summary}`);
    }
    process.stdout.write(lines.join("\n") + "\n");
  } catch {
    // Silent: never block the session on hook failure.
  }
}
