import type { BundleStore } from "../store/types.js";
import type { Debouncer } from "../debounce.js";
import type { AdapterRegistry } from "../adapters/types.js";
import { emptyPcb, type Pcb } from "../pcb/schema.js";
import { mergePatch, type PcbPatch } from "../pcb/merge.js";
import { resolveProjectId } from "../identity/resolver.js";
import { extractSummary } from "../pcb/summary.js";

const PROJECT_ID_PATTERN = /^[A-Za-z0-9._\-]{1,128}$/;

export class InvalidParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParamsError";
  }
}

function requireString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidParamsError(`missing or empty required string arg: ${name}`);
  }
  return value;
}

function assertValidProjectId(projectId: unknown): string {
  const s = requireString("project_id", projectId);
  if (!PROJECT_ID_PATTERN.test(s)) {
    throw new InvalidParamsError(
      `invalid project_id: must match ${PROJECT_ID_PATTERN.toString()} (got ${JSON.stringify(s).slice(0, 80)})`
    );
  }
  return s;
}

// ts-prune-ignore-next
export interface Deps { store: BundleStore; debouncer: Debouncer; adapters: AdapterRegistry; }

async function loadOrCreate(store: BundleStore, projectId: string, sourceIde: string): Promise<Pcb> {
  return (await store.load(projectId)) ?? emptyPcb(projectId, sourceIde);
}

export function buildToolHandlers(deps: Deps) {
  const { store, debouncer } = deps;

  async function save_checkpoint(args: { project_id: string; source_ide: string; bundle_patch: PcbPatch; force?: boolean }) {
    const projectId = assertValidProjectId(args.project_id);
    requireString("source_ide", args.source_ide);
    if (args.bundle_patch == null || typeof args.bundle_patch !== "object") {
      throw new InvalidParamsError("missing or invalid required arg: bundle_patch must be an object");
    }
    if (!args.force && !debouncer.shouldSave(projectId)) {
      return { saved: false, reason: "debounced (30s window)" };
    }
    const base = await loadOrCreate(store, projectId, args.source_ide);
    const merged = mergePatch(base, { ...args.bundle_patch, last_source_ide: args.source_ide });
    if (!merged.conversation.summary) merged.conversation.summary = extractSummary(merged);
    await store.save(merged);
    debouncer.mark(projectId);
    return { saved: true, bundle_id: merged.bundle_id, updated_at: merged.updated_at };
  }

  async function load_checkpoint(args: { project_id: string }) {
    const projectId = assertValidProjectId(args.project_id);
    const bundle = await store.load(projectId);
    return { bundle };
  }

  async function append_decision(args: { project_id: string; text: string; rationale?: string }) {
    const projectId = assertValidProjectId(args.project_id);
    requireString("text", args.text);
    const base = await loadOrCreate(store, projectId, "unknown");
    const id = `d_${base.decisions.length + 1}`;
    const updated = mergePatch(base, {
      decisions: [...base.decisions, { id, at: new Date().toISOString(), text: args.text, rationale: args.rationale }],
    });
    await store.save(updated);
    return { decision_id: id };
  }

  async function append_todo(args: { project_id: string; text: string; status?: "pending" | "in_progress" | "done" }) {
    const projectId = assertValidProjectId(args.project_id);
    requireString("text", args.text);
    const base = await loadOrCreate(store, projectId, "unknown");
    const id = `t_${base.todos.length + 1}`;
    const updated = mergePatch(base, { todos: [...base.todos, { id, text: args.text, status: args.status ?? "pending" }] });
    await store.save(updated);
    return { todo_id: id };
  }

  async function list_projects(_: Record<string, never>) { return { projects: await store.list() }; }

  async function get_project_id(args: { cwd: string }) {
    requireString("cwd", args.cwd);
    const r = await resolveProjectId(args.cwd);
    assertValidProjectId(r.id);
    return { project_id: r.id, resolved_from: r.resolved_from };
  }

  return { save_checkpoint, load_checkpoint, append_decision, append_todo, list_projects, get_project_id };
}
