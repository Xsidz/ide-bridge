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
