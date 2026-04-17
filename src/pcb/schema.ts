import { z } from "zod";
import crypto from "node:crypto";

export const FidelitySchema = z.enum(["L0", "L1", "L2", "L3"]);
export type Fidelity = z.infer<typeof FidelitySchema>;

const ContentBlockSchema = z.object({ type: z.string(), text: z.string().optional() }).passthrough();
const MessageSchema = z.object({ role: z.enum(["user", "assistant", "system"]), content: z.array(ContentBlockSchema) });

export const PcbSchema = z.object({
  pcb_version: z.literal("0.1"),
  bundle_id: z.string(),
  updated_at: z.string().datetime(),
  last_source_ide: z.string(),
  user_id: z.string().nullable(),
  project: z.object({
    id: z.string(),
    resolved_from: z.enum(["explicit", "git", "path"]),
    root_path_fingerprint: z.string(),
    git: z.object({
      remote: z.string(), branch: z.string(), head: z.string(),
      dirty_files: z.array(z.string()),
      staged_diff: z.string().optional(), unstaged_diff: z.string().optional(),
    }).optional(),
  }),
  instructions: z.array(z.object({
    id: z.string(), scope: z.enum(["user", "project", "local"]),
    format: z.literal("markdown"), source_path: z.string(), content: z.string(),
  })),
  memories: z.array(z.object({
    id: z.string(), scope: z.enum(["user", "project", "local"]),
    source: z.enum(["auto", "manual"]), text: z.string(),
    tags: z.array(z.string()).default([]), created_at: z.string(),
  })),
  plan: z.object({
    summary: z.string(), current_step: z.string().nullable(),
    steps: z.array(z.object({ id: z.string(), text: z.string(),
      status: z.enum(["pending", "in_progress", "done"]) })),
  }),
  todos: z.array(z.object({ id: z.string(), text: z.string(),
    status: z.enum(["pending", "in_progress", "done"]).default("pending") })),
  decisions: z.array(z.object({ id: z.string(), at: z.string(),
    text: z.string(), rationale: z.string().optional() })),
  specs: z.array(z.object({ id: z.string(), title: z.string(),
    requirements_md: z.string().optional(), design_md: z.string().optional(),
    tasks_md: z.string().optional() })),
  conversation: z.object({
    fidelity: FidelitySchema, summary: z.string(), summary_through_message: z.number().int(),
    last_n_turns: z.array(MessageSchema), source_transcript_uri: z.string().optional(),
  }),
  workspace: z.object({
    open_files: z.array(z.string()), active_file: z.string().nullable(),
    cursor: z.object({ path: z.string(), line: z.number(), col: z.number() }).nullable(),
  }),
  attachments: z.array(z.object({ id: z.string(), name: z.string(),
    uri: z.string(), media_type: z.string() })),
  capabilities_required: z.array(z.string()),
  last_source_capabilities: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Pcb = z.infer<typeof PcbSchema>;

export function emptyPcb(projectId: string, sourceIde: string): Pcb {
  return {
    pcb_version: "0.1", bundle_id: crypto.randomUUID(),
    updated_at: new Date().toISOString(), last_source_ide: sourceIde, user_id: null,
    project: { id: projectId, resolved_from: "explicit", root_path_fingerprint: "" },
    instructions: [], memories: [],
    plan: { summary: "", current_step: null, steps: [] },
    todos: [], decisions: [], specs: [],
    conversation: { fidelity: "L0", summary: "", summary_through_message: 0, last_n_turns: [] },
    workspace: { open_files: [], active_file: null, cursor: null },
    attachments: [], capabilities_required: [], last_source_capabilities: [], metadata: {},
  };
}
