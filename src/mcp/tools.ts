import type { BundleStore } from "../store/types.js";
import type { Debouncer } from "../debounce.js";
import type { AdapterRegistry } from "../adapters/types.js";
import { emptyPcb, type Pcb } from "../pcb/schema.js";
import { mergePatch, type PcbPatch } from "../pcb/merge.js";
import { resolveProjectId } from "../identity/resolver.js";
import { extractSummary } from "../pcb/summary.js";

// ts-prune-ignore-next
export interface Deps { store: BundleStore; debouncer: Debouncer; adapters: AdapterRegistry; }

async function loadOrCreate(store: BundleStore, projectId: string, sourceIde: string): Promise<Pcb> {
  return (await store.load(projectId)) ?? emptyPcb(projectId, sourceIde);
}

export function buildToolHandlers(deps: Deps) {
  const { store, debouncer } = deps;

  async function save_checkpoint(args: { project_id: string; source_ide: string; bundle_patch: PcbPatch; force?: boolean }) {
    if (!args.force && !debouncer.shouldSave(args.project_id)) {
      return { saved: false, reason: "debounced (30s window)" };
    }
    const base = await loadOrCreate(store, args.project_id, args.source_ide);
    const merged = mergePatch(base, { ...args.bundle_patch, last_source_ide: args.source_ide });
    if (!merged.conversation.summary) merged.conversation.summary = extractSummary(merged);
    await store.save(merged);
    debouncer.mark(args.project_id);
    return { saved: true, bundle_id: merged.bundle_id, updated_at: merged.updated_at };
  }

  async function load_checkpoint(args: { project_id: string }) {
    const bundle = await store.load(args.project_id);
    return { bundle };
  }

  async function append_decision(args: { project_id: string; text: string; rationale?: string }) {
    const base = await loadOrCreate(store, args.project_id, "unknown");
    const id = `d_${base.decisions.length + 1}`;
    const updated = mergePatch(base, {
      decisions: [...base.decisions, { id, at: new Date().toISOString(), text: args.text, rationale: args.rationale }],
    });
    await store.save(updated);
    return { decision_id: id };
  }

  async function append_todo(args: { project_id: string; text: string; status?: "pending" | "in_progress" | "done" }) {
    const base = await loadOrCreate(store, args.project_id, "unknown");
    const id = `t_${base.todos.length + 1}`;
    const updated = mergePatch(base, { todos: [...base.todos, { id, text: args.text, status: args.status ?? "pending" }] });
    await store.save(updated);
    return { todo_id: id };
  }

  async function list_projects(_: Record<string, never>) { return { projects: await store.list() }; }

  async function get_project_id(args: { cwd: string }) {
    const r = await resolveProjectId(args.cwd);
    return { project_id: r.id, resolved_from: r.resolved_from };
  }

  return { save_checkpoint, load_checkpoint, append_decision, append_todo, list_projects, get_project_id };
}
