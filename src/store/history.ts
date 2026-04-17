import fs from "node:fs/promises";
import path from "node:path";
import { historyDir } from "../util/paths.js";
import type { Pcb } from "../pcb/schema.js";
import type { HistoryEntry } from "./types.js";

export async function appendHistory(pcb: Pcb): Promise<HistoryEntry> {
  const dir = historyDir(pcb.project.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${ts}_${pcb.bundle_id}.json`);
  await fs.writeFile(file, JSON.stringify(pcb), { mode: 0o600 });
  return { ts, bundle_id: pcb.bundle_id, path: file };
}

export async function readHistory(projectId: string): Promise<HistoryEntry[]> {
  const dir = historyDir(projectId);
  try {
    const entries = await fs.readdir(dir);
    const parsed: HistoryEntry[] = [];
    for (const name of entries.sort()) {
      if (!name.endsWith(".json")) continue;
      const base = name.slice(0, -".json".length);
      const sep = base.indexOf("_");
      if (sep < 0) continue;
      const ts = base.slice(0, sep);
      const bundle_id = base.slice(sep + 1);
      parsed.push({ ts, bundle_id, path: path.join(dir, name) });
    }
    return parsed;
  } catch {
    return [];
  }
}
