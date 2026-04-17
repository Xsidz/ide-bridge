import type { Pcb } from "./schema.js";

export type PcbPatch = Partial<Pcb>;

function mergeById<T extends { id: string }>(a: T[], b: T[] | undefined): T[] {
  if (!b) return a;
  const byId = new Map(a.map(x => [x.id, x]));
  for (const item of b) byId.set(item.id, item);
  return [...byId.values()];
}

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function safeMergeMetadata(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (BLOCKED_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function mergePatch(base: Pcb, patch: PcbPatch): Pcb {
  return {
    ...base,
    ...(patch.last_source_ide ? { last_source_ide: patch.last_source_ide } : {}),
    project: patch.project ? { ...base.project, ...patch.project } : base.project,
    instructions: mergeById(base.instructions, patch.instructions),
    memories: mergeById(base.memories, patch.memories),
    plan: patch.plan ?? base.plan,
    todos: mergeById(base.todos, patch.todos),
    decisions: mergeById(base.decisions, patch.decisions),
    specs: mergeById(base.specs, patch.specs),
    conversation: patch.conversation ? { ...base.conversation, ...patch.conversation } : base.conversation,
    workspace: patch.workspace ? { ...base.workspace, ...patch.workspace } : base.workspace,
    attachments: mergeById(base.attachments, patch.attachments),
    capabilities_required: patch.capabilities_required ?? base.capabilities_required,
    last_source_capabilities: patch.last_source_capabilities ?? base.last_source_capabilities,
    metadata: safeMergeMetadata(base.metadata, patch.metadata ?? {}),
    updated_at: new Date().toISOString(),
  };
}
