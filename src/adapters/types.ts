import type { Pcb, Fidelity } from "../pcb/schema.js";

export interface ImportReport { fidelity_applied: Fidelity; notes: string[]; }

export interface IdeAdapter {
  ide: string;
  produce_fidelity: Fidelity;
  consume_fidelity: Fidelity;
  extract(projectRoot: string): Promise<Partial<Pcb>>;
  import_into(projectRoot: string, pcb: Pcb): Promise<ImportReport>;
}

export class AdapterRegistry {
  private byIde = new Map<string, IdeAdapter>();
  register(a: IdeAdapter) { this.byIde.set(a.ide, a); }
  get(ide: string) { return this.byIde.get(ide); }
  list() { return [...this.byIde.keys()]; }
}

const order: Fidelity[] = ["L0", "L1", "L2", "L3"];
export function negotiateFidelity(source: Fidelity, target: Fidelity): Fidelity {
  const idx = Math.min(order.indexOf(source), order.indexOf(target));
  return order[idx] ?? "L0";
}
