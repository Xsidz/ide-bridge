import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import type { IdeAdapter, ImportReport } from "./types.js";
import { extractSummary } from "../pcb/summary.js";

function cursorStorageRoot(): string {
  if (process.env.IDE_BRIDGE_CURSOR_STORAGE) return process.env.IDE_BRIDGE_CURSOR_STORAGE;
  const home = os.homedir();
  switch (process.platform) {
    case "darwin": return path.join(home, "Library", "Application Support", "Cursor", "User");
    case "win32":  return path.join(process.env.APPDATA ?? home, "Cursor", "User");
    default:       return path.join(home, ".config", "Cursor", "User");
  }
}

async function findWorkspaceDb(projectRoot: string): Promise<string | null> {
  const root = path.join(cursorStorageRoot(), "workspaceStorage");
  try {
    for (const dir of await fs.readdir(root)) {
      const dbp = path.join(root, dir, "state.vscdb");
      try { await fs.access(dbp); } catch { continue; }
      const d = new Database(dbp, { readonly: true });
      const row = d.prepare("SELECT value FROM ItemTable WHERE key = ?").get("aiService.prompts") as { value?: string } | undefined;
      d.close();
      if (row?.value && typeof row.value === "string" && row.value.includes(projectRoot)) return dbp;
    }
  } catch { /* no storage dir */ }
  return null;
}

export const cursorAdapter: IdeAdapter = {
  ide: "cursor",
  produce_fidelity: "L2",
  consume_fidelity: "L2",
  async extract(projectRoot) {
    const dbp = await findWorkspaceDb(projectRoot);
    if (!dbp) return {};
    const d = new Database(dbp, { readonly: true });
    const row = d.prepare("SELECT value FROM ItemTable WHERE key = ?").get("aiService.prompts") as { value?: string } | undefined;
    d.close();
    if (!row?.value) return {};
    const parsed = JSON.parse(row.value);
    const turns = ((parsed.messages ?? []) as Array<{ role: string; content: unknown }>).slice(-20).map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: [{ type: "text", text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));
    return { conversation: { fidelity: "L2", summary: "", summary_through_message: turns.length, last_n_turns: turns } };
  },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const dir = path.join(projectRoot, ".cursor", "rules");
    await fs.mkdir(dir, { recursive: true });
    const body = [
      "---\nname: ide-bridge imported context\nalwaysApply: true\n---", "",
      "# Prior context (imported from ide-bridge)", "",
      `Summary: ${extractSummary(pcb)}`, "",
      "Call `bridge.load_checkpoint()` for the full bundle before acting.",
    ].join("\n");
    await fs.writeFile(path.join(dir, "_imported.mdc"), body);
    return { fidelity_applied: pcb.conversation.fidelity, notes: ["wrote .cursor/rules/_imported.mdc"] };
  },
};
