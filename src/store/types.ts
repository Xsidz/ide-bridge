import type { Pcb } from "../pcb/schema.js";

export interface HistoryEntry { ts: string; bundle_id: string; path: string; }

export interface BundleStore {
  load(projectId: string): Promise<Pcb | null>;
  save(pcb: Pcb): Promise<void>;
  list(): Promise<string[]>;
  listHistory(projectId: string): Promise<HistoryEntry[]>;
}
