import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { bundlePath, projectDir, storeRoot } from "../util/paths.js";
import { PcbSchema, type Pcb } from "../pcb/schema.js";
import { appendHistory, readHistory } from "./history.js";
import type { BundleStore, HistoryEntry } from "./types.js";

export class FileBundleStore implements BundleStore {
  async load(projectId: string): Promise<Pcb | null> {
    try {
      const raw = await fs.readFile(bundlePath(projectId), "utf8");
      return PcbSchema.parse(JSON.parse(raw));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(pcb: Pcb): Promise<void> {
    const dir = projectDir(pcb.project.id);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const tmp = bundlePath(pcb.project.id) + `.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(pcb, null, 2), { mode: 0o600 });
    await fs.rename(tmp, bundlePath(pcb.project.id));
    await appendHistory(pcb);
  }
  async list(): Promise<string[]> {
    const dir = path.join(storeRoot(), "projects");
    try { return await fs.readdir(dir); } catch { return []; }
  }
  listHistory(projectId: string): Promise<HistoryEntry[]> {
    return readHistory(projectId);
  }
}
