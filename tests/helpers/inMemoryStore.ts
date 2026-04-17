import type { BundleStore, HistoryEntry } from "../../src/store/types.js";
import type { Pcb } from "../../src/pcb/schema.js";

/**
 * BundleStore backed by a plain Map. Zero file I/O.
 * Hooks (onSave/onLoad) let tests inject fault behavior.
 */
export class InMemoryStore implements BundleStore {
  private bundles = new Map<string, Pcb>();
  private history = new Map<string, HistoryEntry[]>();

  onSave?: (pcb: Pcb) => void;
  onLoad?: (projectId: string, current: Pcb | null) => Pcb | null | undefined;

  async load(projectId: string): Promise<Pcb | null> {
    const raw = this.bundles.get(projectId) ?? null;
    if (this.onLoad) {
      const override = this.onLoad(projectId, raw);
      if (override !== undefined) return override;
    }
    return raw;
  }

  async save(pcb: Pcb): Promise<void> {
    if (this.onSave) this.onSave(pcb);
    this.bundles.set(pcb.project.id, pcb);
    const entry: HistoryEntry = {
      ts: pcb.updated_at,
      bundle_id: pcb.bundle_id,
      path: `mem://${pcb.project.id}`,
    };
    const list = this.history.get(pcb.project.id) ?? [];
    list.push(entry);
    this.history.set(pcb.project.id, list);
  }

  async list(): Promise<string[]> {
    return [...this.bundles.keys()];
  }

  async listHistory(projectId: string): Promise<HistoryEntry[]> {
    return this.history.get(projectId) ?? [];
  }

  peek(projectId: string): Pcb | undefined {
    return this.bundles.get(projectId);
  }

  seed(pcb: Pcb): void {
    this.bundles.set(pcb.project.id, pcb);
  }
}
