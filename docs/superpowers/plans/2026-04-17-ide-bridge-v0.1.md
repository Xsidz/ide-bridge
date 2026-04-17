# IDE Bridge v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only MCP daemon (`ide-bridge`) that lets developers save a structured "Portable Context Bundle" (PCB) from one agentic IDE (Claude Code / Cursor / Kiro / Antigravity) and resume it in another with graceful fidelity degradation, with zero infrastructure setup.

**Architecture:** Single Node.js daemon bound to `localhost:31415`, speaking MCP Streamable HTTP (spec 2025-06-18). Six MCP tools (`save_checkpoint`, `load_checkpoint`, `append_decision`, `append_todo`, `list_projects`, `get_project_id`) back onto a file-based bundle store under `~/.ide-bridge/`. Per-IDE adapters extract native state and import PCBs using each IDE's conventions. Claude Code uses native lifecycle hooks; the other three use priming files. All code wired end-to-end with no stubs; the main entrypoint imports and uses every module.

**Tech Stack:**
- Node.js 20+ / TypeScript (strict mode)
- `@modelcontextprotocol/sdk` (available if we want richer MCP semantics later; v0.1 uses raw JSON-RPC over Fastify)
- `fastify` for HTTP transport under MCP
- `zod` for PCB schema validation
- `better-sqlite3` (for reading Cursor's `state.vscdb`)
- `simple-git` (git state extraction; avoids raw shell)
- `commander` (CLI)
- `vitest` for unit + integration tests
- `pnpm` for package management
- ESLint + Prettier, `tsc --noEmit` for typecheck

**Shell-safety rule (applies to every test fixture and adapter):** Never use `execSync` or `exec` with string-concatenated commands. Always `execFileSync` with an args array, or — better — use `simple-git` / Node fs APIs to avoid shell entirely.

**Source layout:**
```
ide-bridge/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.cjs
├── src/
│   ├── index.ts                  # CLI entrypoint
│   ├── daemon.ts                 # Starts HTTP MCP daemon (re-exports startMcpServer)
│   ├── pcb/
│   │   ├── schema.ts             # zod PCB schema v0.1
│   │   ├── merge.ts              # bundle_patch merge logic
│   │   └── summary.ts            # extractive rolling summary
│   ├── store/
│   │   ├── types.ts              # BundleStore interface
│   │   ├── file_store.ts         # file-backed impl
│   │   └── history.ts            # append-only checkpoint log
│   ├── identity/
│   │   ├── resolver.ts           # 3-tier identity resolution
│   │   └── git.ts                # git remote/branch extraction (via simple-git)
│   ├── mcp/
│   │   ├── server.ts             # MCP tool registration
│   │   └── tools.ts              # 6 tool handlers
│   ├── debounce.ts               # 30s per-project save debounce
│   ├── adapters/
│   │   ├── types.ts              # IdeAdapter interface + registry + fidelity negotiation
│   │   ├── claude_code.ts        # L3 adapter
│   │   ├── cursor.ts             # L2 adapter
│   │   ├── kiro.ts               # L1 adapter
│   │   ├── antigravity.ts        # L0-L1 adapter
│   │   └── generic.ts            # L0 fallback
│   ├── priming/
│   │   ├── generator.ts          # writes priming files per IDE
│   │   └── templates/            # markdown templates
│   ├── cli/
│   │   ├── start.ts
│   │   ├── stop.ts
│   │   ├── status.ts
│   │   ├── init.ts
│   │   ├── hook.ts               # `ide-bridge hook save`
│   │   ├── install_service.ts    # launchd + systemd
│   │   └── priming.ts            # writes priming via priming/generator.ts
│   └── util/
│       ├── paths.ts              # per-OS path helpers
│       ├── port.ts               # port probe
│       └── log.ts                # pino logger
└── tests/
    ├── unit/
    │   ├── pcb.schema.test.ts
    │   ├── pcb.merge.test.ts
    │   ├── pcb.summary.test.ts
    │   ├── paths.test.ts
    │   ├── store.file.test.ts
    │   ├── identity.git.test.ts
    │   ├── identity.resolver.test.ts
    │   ├── debounce.test.ts
    │   ├── install_service.test.ts
    │   ├── priming.test.ts
    │   ├── mcp.tools.test.ts
    │   └── adapters/
    │       ├── types.test.ts
    │       ├── generic.test.ts
    │       ├── claude_code.test.ts
    │       ├── cursor.test.ts
    │       ├── kiro.test.ts
    │       └── antigravity.test.ts
    ├── integration/
    │   ├── mcp_server.test.ts
    │   ├── cli.test.ts
    │   └── e2e_handoff.test.ts
    └── fixtures/
        └── claude_code_session.jsonl
```

Every file above is created or modified by a task below. No orphan files, no unused exports. `src/index.ts` transitively imports every adapter and tool handler; if a module is removed but still imported, the build fails.

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/index.ts`, `tests/unit/smoke.test.ts`

- [ ] **Step 1: Initialize pnpm project**

Run:
```bash
mkdir ide-bridge && cd ide-bridge
pnpm init
```

- [ ] **Step 2: Install deps**

Run:
```bash
pnpm add fastify zod commander simple-git better-sqlite3 pino
pnpm add -D typescript @types/node tsx vitest @vitest/coverage-v8 eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { globals: true, environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules
dist
coverage
*.log
.ide-bridge/
```

- [ ] **Step 6: Write smoke test**

File: `tests/unit/smoke.test.ts`
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```

- [ ] **Step 7: Run smoke test**

Run: `pnpm vitest run`
Expected: `1 passed`.

- [ ] **Step 8: Write stub `src/index.ts`** (real entrypoint lands in Task 18)

```ts
#!/usr/bin/env node
console.error("ide-bridge CLI not yet wired (Task 1 scaffold)");
process.exit(1);
```

- [ ] **Step 9: Add scripts and bin to `package.json`**

```json
{
  "name": "ide-bridge",
  "version": "0.1.0-alpha.0",
  "type": "module",
  "bin": { "ide-bridge": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold ide-bridge project with TypeScript + vitest"
```

---

## Task 2: PCB schema

**Files:**
- Create: `src/pcb/schema.ts`, `tests/unit/pcb.schema.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/pcb.schema.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { PcbSchema, type Pcb } from "../../src/pcb/schema.js";

describe("PcbSchema", () => {
  it("accepts a minimal valid PCB", () => {
    const pcb: Pcb = {
      pcb_version: "0.1",
      bundle_id: "01HXYZ",
      updated_at: "2026-04-17T00:00:00Z",
      last_source_ide: "claude-code",
      user_id: null,
      project: { id: "p", resolved_from: "explicit", root_path_fingerprint: "sha256:abc" },
      instructions: [], memories: [],
      plan: { summary: "", current_step: null, steps: [] },
      todos: [], decisions: [], specs: [],
      conversation: { fidelity: "L0", summary: "", summary_through_message: 0, last_n_turns: [] },
      workspace: { open_files: [], active_file: null, cursor: null },
      attachments: [], capabilities_required: [], last_source_capabilities: [], metadata: {},
    };
    expect(PcbSchema.parse(pcb)).toEqual(pcb);
  });

  it("rejects invalid fidelity", () => {
    expect(() => PcbSchema.parse({ conversation: { fidelity: "L9" } })).toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/pcb.schema.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/pcb/schema.ts`**

```ts
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
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/pcb.schema.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/pcb/schema.ts tests/unit/pcb.schema.test.ts
git commit -m "feat(pcb): PCB v0.1 zod schema with fidelity enum and empty factory"
```

---

## Task 3: PCB patch-merge

**Files:**
- Create: `src/pcb/merge.ts`, `tests/unit/pcb.merge.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/pcb.merge.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { mergePatch } from "../../src/pcb/merge.js";
import { emptyPcb } from "../../src/pcb/schema.js";

describe("mergePatch", () => {
  it("appends todos without duplication", () => {
    const base = emptyPcb("p", "ide-a");
    const out = mergePatch(base, { todos: [{ id: "t1", text: "x", status: "pending" }] });
    expect(out.todos).toHaveLength(1);
    const out2 = mergePatch(out, { todos: [{ id: "t1", text: "x updated", status: "pending" }] });
    expect(out2.todos).toHaveLength(1);
    expect(out2.todos[0].text).toBe("x updated");
  });
  it("replaces plan when provided", () => {
    const base = emptyPcb("p", "ide-a");
    const out = mergePatch(base, { plan: { summary: "new", current_step: null, steps: [] } });
    expect(out.plan.summary).toBe("new");
  });
  it("advances updated_at", () => {
    const base = emptyPcb("p", "ide-a");
    const out = mergePatch(base, {});
    expect(new Date(out.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(base.updated_at).getTime());
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/pcb.merge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pcb/merge.ts`**

```ts
import type { Pcb } from "./schema.js";

export type PcbPatch = Partial<Pcb>;

function mergeById<T extends { id: string }>(a: T[], b: T[] | undefined): T[] {
  if (!b) return a;
  const byId = new Map(a.map(x => [x.id, x]));
  for (const item of b) byId.set(item.id, item);
  return [...byId.values()];
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
    metadata: { ...base.metadata, ...(patch.metadata ?? {}) },
    updated_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/pcb.merge.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/pcb/merge.ts tests/unit/pcb.merge.test.ts
git commit -m "feat(pcb): deterministic merge for bundle_patch with id-keyed arrays"
```

---

## Task 4: Extractive rolling summary

**Files:**
- Create: `src/pcb/summary.ts`, `tests/unit/pcb.summary.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/pcb.summary.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { extractSummary } from "../../src/pcb/summary.js";
import { emptyPcb } from "../../src/pcb/schema.js";

describe("extractSummary", () => {
  it("returns a plan-step + decisions + todo synopsis under 500 chars", () => {
    const b = emptyPcb("p", "ide-a");
    b.plan = { summary: "Webhook", current_step: "sig verify",
      steps: [{ id: "s1", text: "scaffold", status: "done" },
              { id: "s2", text: "sig verify", status: "in_progress" }] };
    b.decisions = [{ id: "d1", at: "2026-01-01", text: "HMAC-SHA256" }];
    b.todos = [{ id: "t1", text: "replay test", status: "pending" }];
    const s = extractSummary(b);
    expect(s).toMatch(/sig verify/);
    expect(s).toMatch(/HMAC/);
    expect(s.length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/pcb.summary.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pcb/summary.ts`**

```ts
import type { Pcb } from "./schema.js";

export function extractSummary(pcb: Pcb): string {
  const parts: string[] = [];
  if (pcb.plan.summary) parts.push(`Goal: ${pcb.plan.summary.slice(0, 120)}.`);
  if (pcb.plan.current_step) parts.push(`Now: ${pcb.plan.current_step.slice(0, 80)}.`);
  const recentDecisions = pcb.decisions.slice(-3).map(d => d.text).join("; ");
  if (recentDecisions) parts.push(`Decisions: ${recentDecisions.slice(0, 160)}.`);
  const openTodos = pcb.todos.filter(t => t.status !== "done").slice(0, 3).map(t => t.text).join("; ");
  if (openTodos) parts.push(`Open: ${openTodos.slice(0, 120)}.`);
  return parts.join(" ").slice(0, 500);
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/pcb.summary.test.ts`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/pcb/summary.ts tests/unit/pcb.summary.test.ts
git commit -m "feat(pcb): extractive rolling summary (plan+decisions+todos, 500-char cap)"
```

---

## Task 5: OS path helpers

**Files:**
- Create: `src/util/paths.ts`, `tests/unit/paths.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/paths.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { storeRoot, projectDir, configPath } from "../../src/util/paths.js";

describe("paths", () => {
  it("storeRoot ends with .ide-bridge", () => {
    expect(storeRoot()).toMatch(/\.ide-bridge$/);
  });
  it("projectDir places projects under storeRoot/projects", () => {
    expect(projectDir("my-proj")).toMatch(/\.ide-bridge\/projects\/my-proj$/);
  });
  it("configPath is storeRoot/config.json", () => {
    expect(configPath()).toMatch(/\.ide-bridge\/config\.json$/);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/paths.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/util/paths.ts`**

```ts
import os from "node:os";
import path from "node:path";

export function storeRoot(): string {
  return process.env.IDE_BRIDGE_HOME ?? path.join(os.homedir(), ".ide-bridge");
}
export function projectDir(projectId: string): string {
  return path.join(storeRoot(), "projects", projectId);
}
export function bundlePath(projectId: string): string {
  return path.join(projectDir(projectId), "bundle.json");
}
export function historyDir(projectId: string): string {
  return path.join(projectDir(projectId), "history");
}
export function configPath(): string {
  return path.join(storeRoot(), "config.json");
}
export function logPath(): string {
  return path.join(storeRoot(), "daemon.log");
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/paths.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/util/paths.ts tests/unit/paths.test.ts
git commit -m "feat(util): per-user storage path helpers (IDE_BRIDGE_HOME overridable)"
```

---

## Task 6: File-backed BundleStore

**Files:**
- Create: `src/store/types.ts`, `src/store/history.ts`, `src/store/file_store.ts`, `tests/unit/store.file.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/store.file.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileBundleStore } from "../../src/store/file_store.js";
import { emptyPcb } from "../../src/pcb/schema.js";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "ib-test-"));
  process.env.IDE_BRIDGE_HOME = tmp;
});

describe("FileBundleStore", () => {
  it("load returns null when no bundle", async () => {
    const s = new FileBundleStore();
    expect(await s.load("p")).toBeNull();
  });
  it("save then load round-trips", async () => {
    const s = new FileBundleStore();
    const b = emptyPcb("p", "claude-code");
    await s.save(b);
    const got = await s.load("p");
    expect(got?.bundle_id).toBe(b.bundle_id);
  });
  it("writes history entries on every save", async () => {
    const s = new FileBundleStore();
    await s.save(emptyPcb("p", "a"));
    await s.save(emptyPcb("p", "b"));
    const history = await s.listHistory("p");
    expect(history.length).toBe(2);
  });
  it("list returns all known project ids", async () => {
    const s = new FileBundleStore();
    await s.save(emptyPcb("alpha", "a"));
    await s.save(emptyPcb("beta", "a"));
    const ids = await s.list();
    expect(ids.sort()).toEqual(["alpha", "beta"]);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/store.file.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/store/types.ts`**

```ts
import type { Pcb } from "../pcb/schema.js";

export interface HistoryEntry { ts: string; bundle_id: string; path: string; }

export interface BundleStore {
  load(projectId: string): Promise<Pcb | null>;
  save(pcb: Pcb): Promise<void>;
  list(): Promise<string[]>;
  listHistory(projectId: string): Promise<HistoryEntry[]>;
}
```

- [ ] **Step 4: Implement `src/store/history.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { historyDir } from "../util/paths.js";
import type { Pcb } from "../pcb/schema.js";
import type { HistoryEntry } from "./types.js";

export async function appendHistory(pcb: Pcb): Promise<HistoryEntry> {
  const dir = historyDir(pcb.project.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${ts}-${pcb.bundle_id}.json`);
  await fs.writeFile(file, JSON.stringify(pcb), { mode: 0o600 });
  return { ts, bundle_id: pcb.bundle_id, path: file };
}

export async function readHistory(projectId: string): Promise<HistoryEntry[]> {
  const dir = historyDir(projectId);
  try {
    const entries = await fs.readdir(dir);
    return entries.sort().map(name => {
      const parts = name.replace(/\.json$/, "").split("-");
      const ts = parts.slice(0, 7).join("-");
      const bundle_id = parts.slice(7).join("-");
      return { ts, bundle_id, path: path.join(dir, name) };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Implement `src/store/file_store.ts`**

```ts
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
    const tmp = bundlePath(pcb.project.id) + ".tmp";
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
```

- [ ] **Step 6: Run test — expect pass**

Run: `pnpm vitest run tests/unit/store.file.test.ts`
Expected: `4 passed`.

- [ ] **Step 7: Commit**

```bash
git add src/store tests/unit/store.file.test.ts
git commit -m "feat(store): file-backed BundleStore with atomic write and append-only history"
```

---

## Task 7: Git state extractor (via simple-git, no shell)

**Files:**
- Create: `src/identity/git.ts`, `tests/unit/identity.git.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/identity.git.test.ts`
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeRemote, readGitState } from "../../src/identity/git.js";

describe("normalizeRemote", () => {
  it("strips .git and lowercases host", () => {
    expect(normalizeRemote("git@GitHub.com:Acme/API.git")).toBe("github.com/acme/api");
    expect(normalizeRemote("https://user:tok@github.com/x/y.git")).toBe("github.com/x/y");
  });
});

describe("readGitState", () => {
  let tmp: string;
  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "ib-git-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
    writeFileSync(path.join(tmp, "a.txt"), "hi");
    execFileSync("git", ["add", "."], { cwd: tmp });
    execFileSync("git", ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "-m", "init"], { cwd: tmp });
  });
  it("returns branch and head hash", async () => {
    const g = await readGitState(tmp);
    expect(g?.branch).toBe("main");
    expect(g?.head).toMatch(/^[a-f0-9]{7,}$/);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/identity.git.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/identity/git.ts`**

```ts
import { simpleGit } from "simple-git";

export function normalizeRemote(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[a-z]+:\/\/[^/@]*@/, "");             // strip user:tok@
  s = s.replace(/^git@([^:]+):/, "$1/");                // git@host:owner/repo
  s = s.replace(/^[a-z]+:\/\//, "");                    // strip https://
  s = s.replace(/\.git$/, "");
  const parts = s.split("/");
  const host = parts.shift() ?? "";
  return `${host.toLowerCase()}/${parts.join("/").toLowerCase()}`;
}

export interface GitState {
  remote: string; branch: string; head: string;
  dirty_files: string[]; staged_diff: string; unstaged_diff: string;
}

export async function readGitState(cwd: string): Promise<GitState | null> {
  const git = simpleGit(cwd);
  if (!(await git.checkIsRepo())) return null;
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === "origin");
  const branch = (await git.raw(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  const head = (await git.raw(["rev-parse", "--short", "HEAD"])).trim();
  const status = await git.status();
  return {
    remote: origin?.refs.fetch ?? "",
    branch, head,
    dirty_files: status.files.map(f => f.path),
    staged_diff: await git.diff(["--staged"]),
    unstaged_diff: await git.diff(),
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/identity.git.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/identity/git.ts tests/unit/identity.git.test.ts
git commit -m "feat(identity): git state extractor via simple-git, with remote normalization"
```

---

## Task 8: Identity resolver

**Files:**
- Create: `src/identity/resolver.ts`, `tests/unit/identity.resolver.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/identity.resolver.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveProjectId } from "../../src/identity/resolver.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "ib-res-")); });

describe("resolveProjectId", () => {
  it("prefers .ide-bridge.yaml project_id", async () => {
    writeFileSync(path.join(tmp, ".ide-bridge.yaml"), "project_id: explicit-id\n");
    const res = await resolveProjectId(tmp);
    expect(res).toEqual({ id: "explicit-id", resolved_from: "explicit" });
  });
  it("falls back to path fingerprint when no git, no yaml", async () => {
    const res = await resolveProjectId(tmp);
    expect(res.resolved_from).toBe("path");
    expect(res.id).toMatch(/^path-[a-f0-9]{12}$/);
  });
  it("honors cached .ide-bridge/project-id", async () => {
    mkdirSync(path.join(tmp, ".ide-bridge"), { recursive: true });
    writeFileSync(path.join(tmp, ".ide-bridge", "project-id"), "cached-id\n");
    const res = await resolveProjectId(tmp);
    expect(res.id).toBe("cached-id");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/identity.resolver.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/identity/resolver.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeRemote, readGitState } from "./git.js";

export interface Resolved { id: string; resolved_from: "explicit" | "git" | "path"; }

async function readText(p: string): Promise<string | null> {
  try { return (await fs.readFile(p, "utf8")).trim(); } catch { return null; }
}

export async function resolveProjectId(cwd: string): Promise<Resolved> {
  // 1a: explicit yaml (checked in, wins)
  const yaml = await readText(path.join(cwd, ".ide-bridge.yaml"));
  if (yaml) {
    const m = yaml.match(/^project_id:\s*(\S+)/m);
    if (m && m[1]) return { id: m[1], resolved_from: "explicit" };
  }
  // 1b: local cached project-id (machine-specific, gitignored)
  const cached = await readText(path.join(cwd, ".ide-bridge", "project-id"));
  if (cached) return { id: cached, resolved_from: "explicit" };
  // 2: git remote + branch
  const g = await readGitState(cwd);
  if (g?.remote) {
    const norm = normalizeRemote(g.remote);
    const branchHash = crypto.createHash("sha1").update(g.branch).digest("hex").slice(0, 6);
    return { id: `${norm.replace(/[^a-z0-9]/gi, "-")}-${branchHash}`, resolved_from: "git" };
  }
  // 3: path fingerprint
  const h = crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 12);
  return { id: `path-${h}`, resolved_from: "path" };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/identity.resolver.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/identity tests/unit/identity.resolver.test.ts
git commit -m "feat(identity): 3-tier project resolver (explicit > cached > git > path)"
```

---

## Task 9: Debounce

**Files:**
- Create: `src/debounce.ts`, `tests/unit/debounce.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/debounce.test.ts`
```ts
import { describe, it, expect, vi } from "vitest";
import { Debouncer } from "../../src/debounce.js";

describe("Debouncer", () => {
  it("allows first save, blocks second within window", () => {
    vi.useFakeTimers();
    const d = new Debouncer(30_000);
    expect(d.shouldSave("p")).toBe(true);
    d.mark("p");
    expect(d.shouldSave("p")).toBe(false);
    vi.advanceTimersByTime(29_999);
    expect(d.shouldSave("p")).toBe(false);
    vi.advanceTimersByTime(2);
    expect(d.shouldSave("p")).toBe(true);
    vi.useRealTimers();
  });
  it("is per-project", () => {
    const d = new Debouncer(30_000);
    d.mark("a");
    expect(d.shouldSave("b")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/debounce.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/debounce.ts`**

```ts
export class Debouncer {
  private last = new Map<string, number>();
  constructor(private windowMs: number) {}
  shouldSave(projectId: string): boolean {
    const prev = this.last.get(projectId);
    if (prev === undefined) return true;
    return Date.now() - prev >= this.windowMs;
  }
  mark(projectId: string): void { this.last.set(projectId, Date.now()); }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/debounce.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/debounce.ts tests/unit/debounce.test.ts
git commit -m "feat(debounce): per-project save debounce with configurable window"
```

---

## Task 10: Adapter interface + registry

**Files:**
- Create: `src/adapters/types.ts`, `tests/unit/adapters/types.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/adapters/types.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { AdapterRegistry, negotiateFidelity } from "../../../src/adapters/types.js";

describe("AdapterRegistry", () => {
  it("registers and looks up", () => {
    const r = new AdapterRegistry();
    r.register({
      ide: "cc", produce_fidelity: "L3", consume_fidelity: "L3",
      extract: async () => ({}),
      import_into: async () => ({ fidelity_applied: "L3", notes: [] }),
    });
    expect(r.get("cc")?.produce_fidelity).toBe("L3");
    expect(r.list()).toEqual(["cc"]);
  });
});

describe("negotiateFidelity", () => {
  it("picks min of source produce and target consume", () => {
    expect(negotiateFidelity("L3", "L1")).toBe("L1");
    expect(negotiateFidelity("L0", "L3")).toBe("L0");
    expect(negotiateFidelity("L2", "L2")).toBe("L2");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/adapters/types.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/adapters/types.ts`**

```ts
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
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/adapters/types.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/types.ts tests/unit/adapters/types.test.ts
git commit -m "feat(adapters): IdeAdapter interface + registry + fidelity negotiation"
```

---

## Task 11: Generic fallback adapter (L0)

**Files:**
- Create: `src/adapters/generic.ts`, `tests/unit/adapters/generic.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/adapters/generic.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { genericAdapter } from "../../../src/adapters/generic.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), "ib-gen-")); });

describe("genericAdapter", () => {
  it("produces and consumes L0", () => {
    expect(genericAdapter.produce_fidelity).toBe("L0");
    expect(genericAdapter.consume_fidelity).toBe("L0");
  });
  it("extract returns empty (agent-driven only)", async () => {
    expect(await genericAdapter.extract(tmp)).toEqual({});
  });
  it("import_into writes AGENTS.md with prior-context block", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal X";
    const report = await genericAdapter.import_into(tmp, pcb);
    expect(report.fidelity_applied).toBe("L0");
    const content = readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
    expect(content).toContain("Prior context");
    expect(content).toContain("Goal X");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/adapters/generic.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/adapters/generic.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { IdeAdapter, ImportReport } from "./types.js";
import type { Pcb } from "../pcb/schema.js";
import { extractSummary } from "../pcb/summary.js";

function renderPriorContext(pcb: Pcb): string {
  const s = extractSummary(pcb);
  const decisions = pcb.decisions.slice(-5).map(d => `- ${d.text}${d.rationale ? ` — ${d.rationale}` : ""}`).join("\n");
  const todos = pcb.todos.filter(t => t.status !== "done").map(t => `- [ ] ${t.text}`).join("\n");
  return [
    "# Prior context (from ide-bridge)", "",
    "Before acting, call `bridge.load_checkpoint()` for the full Portable Context Bundle.", "",
    `Summary: ${s || "(none)"}`, "",
    "## Recent decisions", decisions || "(none)", "",
    "## Open TODOs", todos || "(none)", "",
  ].join("\n");
}

export const genericAdapter: IdeAdapter = {
  ide: "generic",
  produce_fidelity: "L0",
  consume_fidelity: "L0",
  async extract() { return {}; },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const file = path.join(projectRoot, "AGENTS.md");
    await fs.writeFile(file, renderPriorContext(pcb));
    return { fidelity_applied: "L0", notes: [`wrote ${file}`] };
  },
};
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/adapters/generic.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/generic.ts tests/unit/adapters/generic.test.ts
git commit -m "feat(adapters): generic AGENTS.md fallback adapter (L0)"
```

---

## Task 12: Claude Code adapter (L3) — forges resumable session

**Files:**
- Create: `src/adapters/claude_code.ts`, `tests/unit/adapters/claude_code.test.ts`, `tests/fixtures/claude_code_session.jsonl`

- [ ] **Step 1: Write fixture**

File: `tests/fixtures/claude_code_session.jsonl`
```
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Add OAuth"}]},"timestamp":"2026-04-17T10:00:00Z","uuid":"u1"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll start by..."}]},"timestamp":"2026-04-17T10:00:01Z","uuid":"u2"}
```

- [ ] **Step 2: Write failing test**

File: `tests/unit/adapters/claude_code.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeCodeAdapter } from "../../../src/adapters/claude_code.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let home: string;
let projectRoot: string;
beforeEach(() => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-cc-"));
  process.env.HOME = home;
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-cc-proj-"));
  const sessionDir = path.join(home, ".claude", "projects", Buffer.from(projectRoot).toString("hex"));
  mkdirSync(sessionDir, { recursive: true });
  copyFileSync("tests/fixtures/claude_code_session.jsonl", path.join(sessionDir, "abc.jsonl"));
});

describe("claudeCodeAdapter", () => {
  it("declares L3 produce/consume", () => {
    expect(claudeCodeAdapter.produce_fidelity).toBe("L3");
    expect(claudeCodeAdapter.consume_fidelity).toBe("L3");
  });
  it("extract reads latest JSONL into conversation.last_n_turns", async () => {
    const p = await claudeCodeAdapter.extract(projectRoot);
    expect(p.conversation?.fidelity).toBe("L3");
    expect(p.conversation?.last_n_turns?.length).toBeGreaterThan(0);
  });
  it("import_into forges a resumable session with source_bundle_id", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.conversation = {
      fidelity: "L3", summary: "", summary_through_message: 0,
      last_n_turns: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    };
    const report = await claudeCodeAdapter.import_into(projectRoot, pcb);
    expect(report.fidelity_applied).toBe("L3");
    const sessionDir = path.join(home, ".claude", "projects", Buffer.from(projectRoot).toString("hex"));
    const files = readdirSync(sessionDir).filter(f => f.endsWith(".jsonl"));
    const forged = files.find(f => f.startsWith("forged-"));
    expect(forged).toBeDefined();
    const content = readFileSync(path.join(sessionDir, forged as string), "utf8");
    expect(content).toContain("source_bundle_id");
    expect(report.notes.some(n => n.includes("claude --resume"))).toBe(true);
  });
});
```

- [ ] **Step 3: Run test — expect fail**

Run: `pnpm vitest run tests/unit/adapters/claude_code.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `src/adapters/claude_code.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import type { IdeAdapter, ImportReport } from "./types.js";

function sessionDir(projectRoot: string): string {
  const encoded = Buffer.from(projectRoot).toString("hex");
  return path.join(process.env.HOME ?? os.homedir(), ".claude", "projects", encoded);
}

async function latestSession(dir: string): Promise<string | null> {
  try {
    const entries = (await fs.readdir(dir)).filter(f => f.endsWith(".jsonl"));
    if (entries.length === 0) return null;
    const stat = await Promise.all(entries.map(async f => ({ f, m: (await fs.stat(path.join(dir, f))).mtimeMs })));
    stat.sort((a, b) => b.m - a.m);
    return path.join(dir, stat[0]!.f);
  } catch { return null; }
}

export const claudeCodeAdapter: IdeAdapter = {
  ide: "claude-code",
  produce_fidelity: "L3",
  consume_fidelity: "L3",
  async extract(projectRoot) {
    const file = await latestSession(sessionDir(projectRoot));
    if (!file) return {};
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
    const messages = lines
      .filter(l => l.type === "user" || l.type === "assistant")
      .map(l => ({ role: l.message.role, content: l.message.content }));
    return {
      conversation: {
        fidelity: "L3",
        summary: "", summary_through_message: messages.length,
        last_n_turns: messages.slice(-20),
        source_transcript_uri: `file://${file}`,
      },
    };
  },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const dir = sessionDir(projectRoot);
    await fs.mkdir(dir, { recursive: true });
    const sessionId = `forged-${crypto.randomUUID()}`;
    const file = path.join(dir, `${sessionId}.jsonl`);
    const turns = pcb.conversation.last_n_turns ?? [];
    const lines = turns.map(t => JSON.stringify({
      type: t.role, message: t, timestamp: new Date().toISOString(),
      uuid: crypto.randomUUID(), source_bundle_id: pcb.bundle_id,
    }));
    await fs.writeFile(file, lines.join("\n") + "\n");
    return {
      fidelity_applied: "L3",
      notes: [`forged session ${sessionId}`, `run: claude --resume ${sessionId}`],
    };
  },
};
```

- [ ] **Step 5: Run test — expect pass**

Run: `pnpm vitest run tests/unit/adapters/claude_code.test.ts`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/claude_code.ts tests/unit/adapters/claude_code.test.ts tests/fixtures/claude_code_session.jsonl
git commit -m "feat(adapters): Claude Code L3 adapter (JSONL read + forged resume with source_bundle_id)"
```

---

## Task 13: Cursor adapter (L2)

**Files:**
- Create: `src/adapters/cursor.ts`, `tests/unit/adapters/cursor.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/adapters/cursor.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { cursorAdapter } from "../../../src/adapters/cursor.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let tmp: string;
let projectRoot: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "ib-cursor-"));
  process.env.IDE_BRIDGE_CURSOR_STORAGE = tmp;
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-cursor-p-"));
});

describe("cursorAdapter", () => {
  it("produce_fidelity=L2, consume_fidelity=L2", () => {
    expect(cursorAdapter.produce_fidelity).toBe("L2");
    expect(cursorAdapter.consume_fidelity).toBe("L2");
  });
  it("extract returns conversation L2 when a SQLite chat is present", async () => {
    const ws = path.join(tmp, "workspaceStorage", "abc");
    mkdirSync(ws, { recursive: true });
    const db = new Database(path.join(ws, "state.vscdb"));
    db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT)");
    const chat = JSON.stringify({
      messages: [
        { role: "user", content: "Add OAuth" },
        { role: "assistant", content: "On it." },
      ],
      folder: projectRoot,
    });
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run("aiService.prompts", chat);
    db.close();
    const p = await cursorAdapter.extract(projectRoot);
    expect(p.conversation?.fidelity).toBe("L2");
    expect(p.conversation?.last_n_turns?.length).toBe(2);
  });
  it("import_into writes .cursor/rules/_imported.mdc primer", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal Y";
    const report = await cursorAdapter.import_into(projectRoot, pcb);
    expect(report.fidelity_applied).toBeDefined();
    const primer = readFileSync(path.join(projectRoot, ".cursor", "rules", "_imported.mdc"), "utf8");
    expect(primer).toContain("Goal Y");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/adapters/cursor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/adapters/cursor.ts`**

```ts
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
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/adapters/cursor.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/cursor.ts tests/unit/adapters/cursor.test.ts
git commit -m "feat(adapters): Cursor L2 adapter (SQLite read + rules primer write)"
```

---

## Task 14: Kiro adapter (L1)

**Files:**
- Create: `src/adapters/kiro.ts`, `tests/unit/adapters/kiro.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/adapters/kiro.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { kiroAdapter } from "../../../src/adapters/kiro.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let projectRoot: string;
beforeEach(() => {
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-kiro-"));
  mkdirSync(path.join(projectRoot, ".kiro", "steering"), { recursive: true });
  mkdirSync(path.join(projectRoot, ".kiro", "specs", "billing"), { recursive: true });
  writeFileSync(path.join(projectRoot, ".kiro", "steering", "style.md"), "# Style\nprefer vitest");
  writeFileSync(path.join(projectRoot, ".kiro", "specs", "billing", "requirements.md"), "# Reqs");
  writeFileSync(path.join(projectRoot, ".kiro", "specs", "billing", "design.md"), "# Design");
  writeFileSync(path.join(projectRoot, ".kiro", "specs", "billing", "tasks.md"), "# Tasks");
});

describe("kiroAdapter", () => {
  it("produce_fidelity=L1, consume_fidelity=L1", () => {
    expect(kiroAdapter.produce_fidelity).toBe("L1");
    expect(kiroAdapter.consume_fidelity).toBe("L1");
  });
  it("extract reads steering + specs", async () => {
    const p = await kiroAdapter.extract(projectRoot);
    expect(p.instructions?.some(i => i.content.includes("prefer vitest"))).toBe(true);
    expect(p.specs?.[0]?.title).toBe("billing");
  });
  it("import_into writes .kiro/steering/_imported.md", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal Z";
    await kiroAdapter.import_into(projectRoot, pcb);
    const imp = readFileSync(path.join(projectRoot, ".kiro", "steering", "_imported.md"), "utf8");
    expect(imp).toContain("Goal Z");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/adapters/kiro.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/adapters/kiro.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { IdeAdapter, ImportReport } from "./types.js";
import { extractSummary } from "../pcb/summary.js";

async function readMdOr(p: string): Promise<string | undefined> {
  try { return await fs.readFile(p, "utf8"); } catch { return undefined; }
}

export const kiroAdapter: IdeAdapter = {
  ide: "kiro",
  produce_fidelity: "L1",
  consume_fidelity: "L1",
  async extract(projectRoot) {
    const steeringDir = path.join(projectRoot, ".kiro", "steering");
    const specsDir = path.join(projectRoot, ".kiro", "specs");
    const instructions: Array<{ id: string; scope: "project"; format: "markdown"; source_path: string; content: string }> = [];
    try {
      for (const f of await fs.readdir(steeringDir)) {
        if (!f.endsWith(".md")) continue;
        const content = await fs.readFile(path.join(steeringDir, f), "utf8");
        instructions.push({
          id: `kiro-steering-${f}`, scope: "project",
          format: "markdown", source_path: path.join(".kiro/steering", f), content,
        });
      }
    } catch { /* no steering dir */ }
    const specs: Array<{ id: string; title: string; requirements_md?: string; design_md?: string; tasks_md?: string }> = [];
    try {
      for (const d of await fs.readdir(specsDir)) {
        const base = path.join(specsDir, d);
        specs.push({
          id: `kiro-spec-${d}`, title: d,
          requirements_md: await readMdOr(path.join(base, "requirements.md")),
          design_md:       await readMdOr(path.join(base, "design.md")),
          tasks_md:        await readMdOr(path.join(base, "tasks.md")),
        });
      }
    } catch { /* no specs dir */ }
    return { instructions, specs };
  },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const dir = path.join(projectRoot, ".kiro", "steering");
    await fs.mkdir(dir, { recursive: true });
    const body = [
      "# Imported context (ide-bridge)", "",
      `Summary: ${extractSummary(pcb)}`, "",
      "Call `bridge.load_checkpoint()` for full PCB.",
    ].join("\n");
    await fs.writeFile(path.join(dir, "_imported.md"), body);
    return { fidelity_applied: "L1", notes: ["wrote .kiro/steering/_imported.md"] };
  },
};
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/adapters/kiro.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/kiro.ts tests/unit/adapters/kiro.test.ts
git commit -m "feat(adapters): Kiro L1 adapter (steering + specs extract, steering-imported write)"
```

---

## Task 15: Antigravity adapter (L0-L1)

**Files:**
- Create: `src/adapters/antigravity.ts`, `tests/unit/adapters/antigravity.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/adapters/antigravity.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { antigravityAdapter } from "../../../src/adapters/antigravity.js";
import { emptyPcb } from "../../../src/pcb/schema.js";

let projectRoot: string;
beforeEach(() => {
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-ag-"));
  writeFileSync(path.join(projectRoot, "AGENTS.md"), "# Project\nUse TypeScript.");
});

describe("antigravityAdapter", () => {
  it("produce/consume L1", () => {
    expect(antigravityAdapter.produce_fidelity).toBe("L1");
    expect(antigravityAdapter.consume_fidelity).toBe("L1");
  });
  it("extract reads AGENTS.md into instructions", async () => {
    const p = await antigravityAdapter.extract(projectRoot);
    expect(p.instructions?.some(i => i.content.includes("Use TypeScript"))).toBe(true);
  });
  it("import_into merges a Prior-context block, preserving existing AGENTS.md content", async () => {
    const pcb = emptyPcb("p", "claude-code");
    pcb.plan.summary = "Goal AG";
    await antigravityAdapter.import_into(projectRoot, pcb);
    const content = readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
    expect(content).toContain("Goal AG");
    expect(content).toContain("Use TypeScript");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/adapters/antigravity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/adapters/antigravity.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { IdeAdapter, ImportReport } from "./types.js";
import { extractSummary } from "../pcb/summary.js";

const START = "<!-- ide-bridge:start -->";
const END = "<!-- ide-bridge:end -->";

async function readAgentsMd(projectRoot: string): Promise<string> {
  try { return await fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8"); } catch { return ""; }
}

function stripBridgeBlock(content: string): string {
  const re = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, "g");
  return content.replace(re, "").trimStart();
}

export const antigravityAdapter: IdeAdapter = {
  ide: "antigravity",
  produce_fidelity: "L1",
  consume_fidelity: "L1",
  async extract(projectRoot) {
    const content = await readAgentsMd(projectRoot);
    if (!content) return {};
    return {
      instructions: [{
        id: "antigravity-agents-md", scope: "project", format: "markdown",
        source_path: "AGENTS.md", content: stripBridgeBlock(content),
      }],
    };
  },
  async import_into(projectRoot, pcb): Promise<ImportReport> {
    const file = path.join(projectRoot, "AGENTS.md");
    const existing = stripBridgeBlock(await readAgentsMd(projectRoot));
    const block = [
      START,
      "# Prior context (ide-bridge)",
      `Summary: ${extractSummary(pcb)}`,
      "Call `bridge.load_checkpoint()` before acting.",
      END,
    ].join("\n");
    await fs.writeFile(file, `${block}\n\n${existing}`);
    return { fidelity_applied: "L1", notes: [`merged ide-bridge block into ${file}`] };
  },
};
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/adapters/antigravity.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/antigravity.ts tests/unit/adapters/antigravity.test.ts
git commit -m "feat(adapters): Antigravity L1 adapter (AGENTS.md merge with bridge-block markers)"
```

---

## Task 16: MCP tool handlers

**Files:**
- Create: `src/mcp/tools.ts`, `tests/unit/mcp.tools.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/mcp.tools.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildToolHandlers } from "../../src/mcp/tools.js";
import { FileBundleStore } from "../../src/store/file_store.js";
import { Debouncer } from "../../src/debounce.js";
import { AdapterRegistry } from "../../src/adapters/types.js";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "ib-tools-"));
  process.env.IDE_BRIDGE_HOME = tmp;
});

describe("tool handlers", () => {
  it("save_checkpoint creates bundle if none, merges if exists", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    const r1 = await h.save_checkpoint({ project_id: "p", source_ide: "claude-code",
      bundle_patch: { plan: { summary: "first", current_step: null, steps: [] } } });
    expect(r1.saved).toBe(true);
    const r2 = await h.save_checkpoint({ project_id: "p", source_ide: "claude-code",
      bundle_patch: { todos: [{ id: "t1", text: "x", status: "pending" }] } });
    expect(r2.saved).toBe(true);
    const loaded = await h.load_checkpoint({ project_id: "p" });
    expect(loaded.bundle?.plan.summary).toBe("first");
    expect(loaded.bundle?.todos).toHaveLength(1);
  });
  it("debouncer blocks save within window", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(60_000), adapters: new AdapterRegistry() });
    await h.save_checkpoint({ project_id: "p", source_ide: "claude-code", bundle_patch: {} });
    const r2 = await h.save_checkpoint({ project_id: "p", source_ide: "claude-code", bundle_patch: {} });
    expect(r2.saved).toBe(false);
    expect(r2.reason).toMatch(/debounced/);
  });
  it("append_decision and append_todo mutate persisted bundle", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    await h.append_decision({ project_id: "p", text: "use HMAC", rationale: "spec" });
    await h.append_todo({ project_id: "p", text: "write test" });
    const { bundle } = await h.load_checkpoint({ project_id: "p" });
    expect(bundle?.decisions.some(d => d.text === "use HMAC")).toBe(true);
    expect(bundle?.todos.some(t => t.text === "write test")).toBe(true);
  });
  it("list_projects returns known ids", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    await h.append_todo({ project_id: "alpha", text: "x" });
    await h.append_todo({ project_id: "beta",  text: "y" });
    const { projects } = await h.list_projects({});
    expect(projects.sort()).toEqual(["alpha", "beta"]);
  });
  it("get_project_id resolves from cwd", async () => {
    const h = buildToolHandlers({ store: new FileBundleStore(), debouncer: new Debouncer(0), adapters: new AdapterRegistry() });
    const r = await h.get_project_id({ cwd: tmp });
    expect(r.project_id).toMatch(/^path-/);
    expect(r.resolved_from).toBe("path");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/mcp.tools.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp/tools.ts`**

```ts
import type { BundleStore } from "../store/types.js";
import type { Debouncer } from "../debounce.js";
import type { AdapterRegistry } from "../adapters/types.js";
import { emptyPcb, type Pcb } from "../pcb/schema.js";
import { mergePatch, type PcbPatch } from "../pcb/merge.js";
import { resolveProjectId } from "../identity/resolver.js";
import { extractSummary } from "../pcb/summary.js";

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
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/mcp.tools.test.ts`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools.ts tests/unit/mcp.tools.test.ts
git commit -m "feat(mcp): 6 tool handlers with debounce, merge, summary extraction"
```

---

## Task 17: MCP HTTP server wiring

**Files:**
- Create: `src/util/log.ts`, `src/util/port.ts`, `src/mcp/server.ts`, `src/daemon.ts`, `tests/integration/mcp_server.test.ts`

- [ ] **Step 1: Implement `src/util/log.ts`**

```ts
import pino from "pino";
export const logger = pino({ level: process.env.IDE_BRIDGE_LOG_LEVEL ?? "info" });
```

- [ ] **Step 2: Implement `src/util/port.ts`**

```ts
import net from "node:net";
export async function findFreePort(start: number, end: number): Promise<number> {
  for (let p = start; p <= end; p++) {
    const free = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p, "127.0.0.1");
    });
    if (free) return p;
  }
  throw new Error(`No free port in [${start}, ${end}]`);
}
```

- [ ] **Step 3: Write failing integration test**

File: `tests/integration/mcp_server.test.ts`
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";

let stop: () => Promise<void>;
let url: string;

beforeEach(async () => {
  process.env.IDE_BRIDGE_HOME = mkdtempSync(path.join(os.tmpdir(), "ib-mcp-"));
  const s = await startMcpServer({ port: 0 });
  stop = s.stop; url = s.url;
});
afterEach(async () => stop());

describe("MCP HTTP server", () => {
  it("lists 6 tools", async () => {
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    const r = await fetch(`${url}/mcp`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json() as { result: { tools: Array<{ name: string }> } };
    expect(j.result.tools.map(t => t.name).sort()).toEqual(
      ["append_decision", "append_todo", "get_project_id", "list_projects", "load_checkpoint", "save_checkpoint"]
    );
  });
  it("save_checkpoint + load_checkpoint round-trips via tool call", async () => {
    await fetch(`${url}/mcp`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "save_checkpoint",
          arguments: { project_id: "p", source_ide: "claude-code",
            bundle_patch: { plan: { summary: "hi", current_step: null, steps: [] } } } } }) });
    const r = await fetch(`${url}/mcp`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: "load_checkpoint", arguments: { project_id: "p" } } }) });
    const j = await r.json() as { result: { content: Array<{ text: string }> } };
    const parsed = JSON.parse(j.result.content[0]!.text);
    expect(parsed.bundle.plan.summary).toBe("hi");
  });
});
```

- [ ] **Step 4: Run test — expect fail**

Run: `pnpm vitest run tests/integration/mcp_server.test.ts`
Expected: FAIL.

- [ ] **Step 5: Implement `src/mcp/server.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";
import { FileBundleStore } from "../store/file_store.js";
import { Debouncer } from "../debounce.js";
import { AdapterRegistry } from "../adapters/types.js";
import { buildToolHandlers } from "./tools.js";
import { claudeCodeAdapter } from "../adapters/claude_code.js";
import { cursorAdapter } from "../adapters/cursor.js";
import { kiroAdapter } from "../adapters/kiro.js";
import { antigravityAdapter } from "../adapters/antigravity.js";
import { genericAdapter } from "../adapters/generic.js";
import { logger } from "../util/log.js";
import { findFreePort } from "../util/port.js";

export interface StartOpts { port: number; }
export interface Handle { url: string; port: number; stop: () => Promise<void>; }

const TOOL_DESCRIPTIONS: Record<string, string> = {
  save_checkpoint: "Merge a PCB fragment into the active project bundle.",
  load_checkpoint: "Returns the active bundle for the current project.",
  append_decision: "Append a design decision to the bundle.",
  append_todo:     "Append a TODO to the bundle.",
  list_projects:   "List all known projects.",
  get_project_id:  "Resolve the project identity for a cwd.",
};

export async function startMcpServer(opts: StartOpts): Promise<Handle> {
  const adapters = new AdapterRegistry();
  [claudeCodeAdapter, cursorAdapter, kiroAdapter, antigravityAdapter, genericAdapter]
    .forEach(a => adapters.register(a));
  const handlers = buildToolHandlers({
    store: new FileBundleStore(), debouncer: new Debouncer(30_000), adapters,
  });

  const app: FastifyInstance = Fastify({ logger: false });

  app.post("/mcp", async (req, reply) => {
    const body = req.body as { jsonrpc: string; id: number | string; method: string; params?: { name?: string; arguments?: unknown } };
    if (body.method === "initialize") {
      return reply.send({ jsonrpc: "2.0", id: body.id,
        result: { protocolVersion: "2025-06-18", serverInfo: { name: "ide-bridge", version: "0.1.0" },
          capabilities: { tools: {} } } });
    }
    if (body.method === "tools/list") {
      return reply.send({
        jsonrpc: "2.0", id: body.id,
        result: { tools: Object.keys(handlers).map(name => ({
          name, description: TOOL_DESCRIPTIONS[name] ?? name,
          inputSchema: { type: "object", additionalProperties: true },
        })) },
      });
    }
    if (body.method === "tools/call") {
      const name = body.params?.name;
      const args = body.params?.arguments ?? {};
      const fn = (handlers as Record<string, (a: unknown) => Promise<unknown>>)[name ?? ""];
      if (!fn) return reply.send({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `unknown tool ${name}` } });
      const result = await fn(args);
      return reply.send({ jsonrpc: "2.0", id: body.id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
    }
    return reply.send({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "method not implemented" } });
  });

  const port = opts.port > 0 ? opts.port : await findFreePort(31415, 31425);
  await app.listen({ host: "127.0.0.1", port });
  logger.info({ port }, "ide-bridge daemon listening");
  return {
    url: `http://127.0.0.1:${port}`, port,
    stop: async () => { await app.close(); },
  };
}
```

- [ ] **Step 6: Implement `src/daemon.ts`** (thin re-export for CLI usage)

```ts
export { startMcpServer } from "./mcp/server.js";
export type { StartOpts, Handle } from "./mcp/server.js";
```

- [ ] **Step 7: Run test — expect pass**

Run: `pnpm vitest run tests/integration/mcp_server.test.ts`
Expected: `2 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/mcp/server.ts src/daemon.ts src/util/log.ts src/util/port.ts tests/integration/mcp_server.test.ts
git commit -m "feat(mcp): Streamable HTTP server wiring all 6 tools + adapter registry"
```

---

## Task 18: CLI commands (start, stop, status, init, hook)

**Files:**
- Create: `src/cli/start.ts`, `src/cli/stop.ts`, `src/cli/status.ts`, `src/cli/init.ts`, `src/cli/hook.ts`
- Stub-create (filled in by Tasks 19, 20): `src/cli/install_service.ts`, `src/cli/priming.ts`
- Overwrite: `src/index.ts`
- Create: `tests/integration/cli.test.ts`

- [ ] **Step 1: Write failing integration test**

File: `tests/integration/cli.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function cli(args: string[], env: Record<string, string> = {}) {
  return execFileSync("pnpm", ["exec", "tsx", "src/index.ts", ...args],
    { env: { ...process.env, ...env }, encoding: "utf8" });
}

let home: string;
let proj: string;
beforeEach(() => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-cli-"));
  proj = mkdtempSync(path.join(os.tmpdir(), "ib-cli-p-"));
});

describe("ide-bridge CLI", () => {
  it("status reports not running initially", () => {
    const out = cli(["status"], { IDE_BRIDGE_HOME: home });
    expect(out).toMatch(/not running/i);
  });
  it("init writes .ide-bridge.yaml and mentions checked-in default", () => {
    const out = cli(["init"], { IDE_BRIDGE_HOME: home, PWD: proj });
    expect(out).toMatch(/checked in/i);
    expect(existsSync(path.join(proj, ".ide-bridge.yaml"))).toBe(true);
  });
  it("init --gitignore also appends to .gitignore", () => {
    cli(["init", "--gitignore"], { IDE_BRIDGE_HOME: home, PWD: proj });
    const gi = readFileSync(path.join(proj, ".gitignore"), "utf8");
    expect(gi).toMatch(/\.ide-bridge\.yaml/);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/integration/cli.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/cli/start.ts`**

```ts
import fs from "node:fs/promises";
import { startMcpServer } from "../mcp/server.js";
import { configPath, storeRoot } from "../util/paths.js";

export async function cmdStart(opts: { port?: number; remote?: string }) {
  if (opts.remote) {
    console.error("--remote is not yet implemented (v0.2)");
    process.exit(2);
  }
  await fs.mkdir(storeRoot(), { recursive: true, mode: 0o700 });
  const handle = await startMcpServer({ port: opts.port ?? 31415 });
  await fs.writeFile(configPath(), JSON.stringify({ port: handle.port, pid: process.pid }, null, 2));
  console.log(`ide-bridge listening on ${handle.url}/mcp`);
  process.on("SIGINT",  async () => { await handle.stop(); process.exit(0); });
  process.on("SIGTERM", async () => { await handle.stop(); process.exit(0); });
}
```

- [ ] **Step 4: Implement `src/cli/stop.ts`**

```ts
import fs from "node:fs/promises";
import { configPath } from "../util/paths.js";

export async function cmdStop() {
  try {
    const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
    if (!cfg.pid) { console.error("no recorded pid"); process.exit(1); }
    process.kill(cfg.pid, "SIGTERM");
    console.log(`stopped pid=${cfg.pid}`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") console.error("ide-bridge is not running");
    else throw e;
  }
}
```

- [ ] **Step 5: Implement `src/cli/status.ts`**

```ts
import fs from "node:fs/promises";
import { configPath } from "../util/paths.js";

export async function cmdStatus() {
  try {
    const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
    try {
      process.kill(cfg.pid, 0);
      console.log(`running pid=${cfg.pid} port=${cfg.port}`);
    } catch { console.log("not running (stale config)"); }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") console.log("not running");
    else throw e;
  }
}
```

- [ ] **Step 6: Implement `src/cli/init.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";

export async function cmdInit(opts: { gitignore?: boolean }) {
  const cwd = process.env.PWD ?? process.cwd();
  const yaml = path.join(cwd, ".ide-bridge.yaml");
  const projectId = path.basename(cwd);
  const body = `project_id: ${projectId}\n# checked in by default — share across machines/teammates.\n# Pass --gitignore on init or add to .gitignore to keep private.\n`;
  await fs.writeFile(yaml, body);
  console.log(`wrote ${yaml} (checked in by default)`);
  if (opts.gitignore) {
    const gi = path.join(cwd, ".gitignore");
    let prev = "";
    try { prev = await fs.readFile(gi, "utf8"); } catch { /* .gitignore absent */ }
    if (!prev.includes(".ide-bridge.yaml")) {
      const sep = prev.endsWith("\n") || prev === "" ? "" : "\n";
      await fs.writeFile(gi, prev + sep + ".ide-bridge.yaml\n");
    }
  }
}
```

- [ ] **Step 7: Implement `src/cli/hook.ts`**

```ts
import fs from "node:fs/promises";
import { configPath } from "../util/paths.js";

export async function cmdHookSave(opts: { projectDir?: string }) {
  const cfg = JSON.parse(await fs.readFile(configPath(), "utf8"));
  const url = `http://127.0.0.1:${cfg.port}/mcp`;
  const body = { jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "save_checkpoint", arguments: {
      project_id: opts.projectDir ?? process.cwd(), source_ide: "claude-code", bundle_patch: {} } } };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  process.stdout.write(JSON.stringify((j as { result: unknown }).result) + "\n");
}
```

- [ ] **Step 8: Stub `src/cli/install_service.ts` (implemented in Task 19)**

```ts
export async function cmdInstallService() { throw new Error("install_service implemented in Task 19"); }
export function renderLaunchdPlist(_: string): string { throw new Error("implemented in Task 19"); }
export function renderSystemdUnit(_: string): string { throw new Error("implemented in Task 19"); }
```

- [ ] **Step 9: Stub `src/cli/priming.ts` (implemented in Task 20)**

```ts
export async function cmdPriming(_ide: string) { throw new Error("priming implemented in Task 20"); }
```

- [ ] **Step 10: Write `src/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { cmdStart } from "./cli/start.js";
import { cmdStop } from "./cli/stop.js";
import { cmdStatus } from "./cli/status.js";
import { cmdInit } from "./cli/init.js";
import { cmdHookSave } from "./cli/hook.js";
import { cmdInstallService } from "./cli/install_service.js";
import { cmdPriming } from "./cli/priming.js";

const program = new Command();
program.name("ide-bridge").description("Cross-IDE context bridge (MCP)").version("0.1.0");

program.command("start")
  .option("-p, --port <port>", "port", (v: string) => parseInt(v, 10))
  .option("--remote <url>", "(v0.2 stub)")
  .action(cmdStart);
program.command("stop").action(cmdStop);
program.command("status").action(cmdStatus);
program.command("init").option("--gitignore", "also add to .gitignore").action(cmdInit);

const hook = program.command("hook").description("IDE lifecycle hooks");
hook.command("save").action(cmdHookSave);

program.command("install-service").description("install launchd/systemd unit").action(cmdInstallService);
program.command("priming <ide>").description("write per-IDE priming file").action(cmdPriming);

program.parseAsync(process.argv);
```

- [ ] **Step 11: Run tests — expect pass**

Run: `pnpm vitest run tests/integration/cli.test.ts`
Expected: `3 passed`.

- [ ] **Step 12: Commit**

```bash
git add src tests/integration/cli.test.ts
git commit -m "feat(cli): start/stop/status/init/hook commands + commander wiring"
```

---

## Task 19: install-service (launchd + systemd)

**Files:**
- Modify: `src/cli/install_service.ts`
- Create: `tests/unit/install_service.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/unit/install_service.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { renderLaunchdPlist, renderSystemdUnit } from "../../src/cli/install_service.js";

describe("service unit templates", () => {
  it("plist includes ide-bridge start and localhost binding", () => {
    const s = renderLaunchdPlist("/usr/local/bin/ide-bridge");
    expect(s).toContain("<string>/usr/local/bin/ide-bridge</string>");
    expect(s).toContain("<string>start</string>");
    expect(s).toContain("com.ide-bridge.daemon");
  });
  it("systemd unit sets ExecStart and Restart", () => {
    const s = renderSystemdUnit("/usr/local/bin/ide-bridge");
    expect(s).toContain("ExecStart=/usr/local/bin/ide-bridge start");
    expect(s).toContain("Restart=on-failure");
  });
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `pnpm vitest run tests/unit/install_service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/cli/install_service.ts`** (overwrite stub)

```ts
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export function renderLaunchdPlist(binary: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.ide-bridge.daemon</string>
<key>ProgramArguments</key><array><string>${binary}</string><string>start</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
</dict></plist>`;
}

export function renderSystemdUnit(binary: string): string {
  return `[Unit]
Description=ide-bridge daemon
After=network.target

[Service]
ExecStart=${binary} start
Restart=on-failure

[Install]
WantedBy=default.target
`;
}

export async function cmdInstallService() {
  const bin = process.env.IDE_BRIDGE_BIN ?? "ide-bridge";
  if (process.platform === "darwin") {
    const p = path.join(os.homedir(), "Library", "LaunchAgents", "com.ide-bridge.daemon.plist");
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, renderLaunchdPlist(bin));
    console.log(`wrote ${p}\nload with: launchctl load ${p}`);
  } else if (process.platform === "linux") {
    const p = path.join(os.homedir(), ".config", "systemd", "user", "ide-bridge.service");
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, renderSystemdUnit(bin));
    console.log(`wrote ${p}\nenable with: systemctl --user enable --now ide-bridge.service`);
  } else {
    throw new Error(`install-service not supported on ${process.platform}`);
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `pnpm vitest run tests/unit/install_service.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/cli/install_service.ts tests/unit/install_service.test.ts
git commit -m "feat(cli): install-service writes launchd plist / systemd user unit"
```

---

## Task 20: Priming file generator

**Files:**
- Create: `src/priming/templates/claude_code.md`, `src/priming/templates/cursor.mdc`, `src/priming/templates/kiro.md`, `src/priming/templates/antigravity.md`, `src/priming/templates/generic.md`
- Create: `src/priming/generator.ts`
- Modify: `src/cli/priming.ts`
- Create: `tests/unit/priming.test.ts`

- [ ] **Step 1: Create template files**

File: `src/priming/templates/generic.md`
```
# IDE Bridge: context priming

You have access to an MCP server (`bridge.*`) that preserves project context across IDEs.

On start, call `bridge.load_checkpoint()` before doing anything else. Use the returned PCB's plan, decisions, todos, and conversation summary to align with prior work.

Save a checkpoint via `bridge.save_checkpoint({ project_id, source_ide, bundle_patch })`:
- Before file edits
- After completing a sub-task
- When the user says "pause", "switch IDE", or "handoff"
- Whenever a new plan step, TODO, or decision appears

Use `bridge.append_decision(text, rationale)` for design decisions and `bridge.append_todo(text)` for TODOs.
```

File: `src/priming/templates/claude_code.md`
```
## IDE Bridge (context portability)

Call `bridge.load_checkpoint` at the start of each session. Save via `bridge.save_checkpoint` on sub-task completion, before file edits, and when asked to pause or handoff. Use `bridge.append_decision` and `bridge.append_todo` for those record types. The daemon also auto-saves on Stop/PostToolUse hooks — redundancy is fine.
```

File: `src/priming/templates/cursor.mdc`
```
---
name: ide-bridge priming
alwaysApply: true
---

On start, call `bridge.load_checkpoint` to load prior project context. Save via `bridge.save_checkpoint` before file edits and after sub-task completion. Use `bridge.append_decision` and `bridge.append_todo` for those record types.
```

File: `src/priming/templates/kiro.md`
```
# ide-bridge priming (Kiro steering)

On spec or session start, call `bridge.load_checkpoint` to retrieve prior-session plan, decisions, and todos. Write new decisions through `bridge.append_decision` and todos through `bridge.append_todo`. Save a checkpoint with `bridge.save_checkpoint` when pausing or handing off.
```

File: `src/priming/templates/antigravity.md`
```
# IDE Bridge priming

On start, call `bridge.load_checkpoint` for prior context. Save via `bridge.save_checkpoint` before edits and when handing off. Use `bridge.append_decision` and `bridge.append_todo` for those record types.
```

- [ ] **Step 2: Write failing test**

File: `tests/unit/priming.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writePriming } from "../../src/priming/generator.js";

let p: string;
beforeEach(() => { p = mkdtempSync(path.join(os.tmpdir(), "ib-prim-")); });

describe("writePriming", () => {
  it("writes claude-code priming to CLAUDE.md", async () => {
    await writePriming("claude-code", p);
    expect(readFileSync(path.join(p, "CLAUDE.md"), "utf8")).toContain("IDE Bridge");
  });
  it("writes cursor priming to .cursor/rules/ide-bridge.mdc", async () => {
    await writePriming("cursor", p);
    expect(existsSync(path.join(p, ".cursor", "rules", "ide-bridge.mdc"))).toBe(true);
  });
  it("writes kiro priming to .kiro/steering/ide-bridge.md", async () => {
    await writePriming("kiro", p);
    expect(existsSync(path.join(p, ".kiro", "steering", "ide-bridge.md"))).toBe(true);
  });
  it("writes antigravity/generic priming to AGENTS.md", async () => {
    await writePriming("generic", p);
    expect(existsSync(path.join(p, "AGENTS.md"))).toBe(true);
  });
  it("rejects unknown ide", async () => {
    await expect(writePriming("foo", p)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test — expect fail**

Run: `pnpm vitest run tests/unit/priming.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `src/priming/generator.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const ROUTES: Record<string, { template: string; dest: string; appendMode?: boolean }> = {
  "claude-code": { template: "claude_code.md", dest: "CLAUDE.md", appendMode: true },
  cursor:        { template: "cursor.mdc",     dest: ".cursor/rules/ide-bridge.mdc" },
  kiro:          { template: "kiro.md",        dest: ".kiro/steering/ide-bridge.md" },
  antigravity:   { template: "antigravity.md", dest: "AGENTS.md", appendMode: true },
  generic:       { template: "generic.md",     dest: "AGENTS.md", appendMode: true },
};

export async function writePriming(ide: string, projectRoot: string): Promise<string> {
  const route = ROUTES[ide];
  if (!route) throw new Error(`unknown ide: ${ide}`);
  const body = await fs.readFile(path.join(here, "templates", route.template), "utf8");
  const dest = path.join(projectRoot, route.dest);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (route.appendMode) {
    let existing = "";
    try { existing = await fs.readFile(dest, "utf8"); } catch { /* file absent */ }
    const marker = "<!-- ide-bridge:priming -->";
    if (!existing.includes(marker)) {
      const sep = existing ? existing + "\n\n" : "";
      await fs.writeFile(dest, `${sep}${marker}\n${body}`);
    }
  } else {
    await fs.writeFile(dest, body);
  }
  return dest;
}
```

- [ ] **Step 5: Overwrite `src/cli/priming.ts`**

```ts
import { writePriming } from "../priming/generator.js";

export async function cmdPriming(ide: string) {
  const root = process.env.PWD ?? process.cwd();
  const file = await writePriming(ide, root);
  console.log(`wrote ${file}`);
}
```

- [ ] **Step 6: Ensure templates are copied to `dist` at build time. Add a prebuild script**

Add to `package.json`:
```json
{
  "scripts": {
    "prebuild": "node -e \"require('node:fs').cpSync('src/priming/templates','dist/priming/templates',{recursive:true})\"",
    "build": "tsc"
  }
}
```

- [ ] **Step 7: Run tests — expect pass**

Run: `pnpm vitest run tests/unit/priming.test.ts`
Expected: `5 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/priming src/cli/priming.ts tests/unit/priming.test.ts package.json
git commit -m "feat(priming): per-IDE priming generator with marker-safe append"
```

---

## Task 21: End-to-end handoff test (the headline demo)

**Files:**
- Create: `tests/integration/e2e_handoff.test.ts`

- [ ] **Step 1: Write the end-to-end test**

File: `tests/integration/e2e_handoff.test.ts`
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMcpServer } from "../../src/mcp/server.js";
import { claudeCodeAdapter } from "../../src/adapters/claude_code.js";
import { cursorAdapter } from "../../src/adapters/cursor.js";
import { emptyPcb } from "../../src/pcb/schema.js";

let stop: () => Promise<void>;
let url: string;
let home: string;
let projectRoot: string;

beforeEach(async () => {
  home = mkdtempSync(path.join(os.tmpdir(), "ib-e2e-"));
  process.env.IDE_BRIDGE_HOME = home;
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "ib-e2e-p-"));
  const s = await startMcpServer({ port: 0 });
  stop = s.stop; url = s.url;
});
afterEach(async () => stop());

async function call<T>(name: string, args: unknown): Promise<T> {
  const r = await fetch(`${url}/mcp`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
  const j = await r.json() as { result: { content: Array<{ text: string }> } };
  return JSON.parse(j.result.content[0]!.text) as T;
}

describe("e2e handoff", () => {
  it("Claude Code -> Cursor: plan + decision + todo travel end to end", async () => {
    await call("save_checkpoint", { project_id: "p", source_ide: "claude-code",
      bundle_patch: { plan: { summary: "Implement Stripe webhook", current_step: "sig verify", steps: [] } } });
    await call("append_decision", { project_id: "p", text: "Use raw body + HMAC-SHA256", rationale: "Stripe spec requires raw body" });
    await call("append_todo", { project_id: "p", text: "Write replay-attack test" });

    const { bundle } = await call<{ bundle: ReturnType<typeof emptyPcb> }>("load_checkpoint", { project_id: "p" });
    expect(bundle.plan.summary).toBe("Implement Stripe webhook");
    expect(bundle.decisions[0]!.text).toMatch(/HMAC/);
    expect(bundle.todos[0]!.text).toMatch(/replay/);

    await cursorAdapter.import_into(projectRoot, bundle);
    const primer = readFileSync(path.join(projectRoot, ".cursor", "rules", "_imported.mdc"), "utf8");
    expect(primer).toMatch(/Stripe webhook/);
    expect(primer).toMatch(/HMAC|Decisions/);
  });

  it("Claude Code L3 round trip: extract -> bundle -> forged-session import", async () => {
    process.env.HOME = home;
    const encoded = Buffer.from(projectRoot).toString("hex");
    const sessionDir = path.join(home, ".claude", "projects", encoded);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionDir, "src.jsonl"),
      `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"hi"}]},"timestamp":"2026-04-17T00:00:00Z","uuid":"x"}\n`
    );

    const extracted = await claudeCodeAdapter.extract(projectRoot);
    expect(extracted.conversation?.last_n_turns?.length).toBe(1);

    const pcb = emptyPcb("p", "claude-code");
    const merged = { ...pcb, conversation: extracted.conversation! };
    const report = await claudeCodeAdapter.import_into(projectRoot, merged);
    expect(report.notes.some(n => n.includes("claude --resume"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect pass**

Run: `pnpm vitest run tests/integration/e2e_handoff.test.ts`
Expected: `2 passed`. If anything fails, fix the underlying module — this test is the v0.1 acceptance gate.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/e2e_handoff.test.ts
git commit -m "test(e2e): Claude Code -> Cursor handoff and CC L3 round-trip"
```

---

## Task 22: Full suite green + typecheck + lint + dead-code audit + README

**Files:**
- Create: `README.md`
- Verify: every prior file

- [ ] **Step 1: Run full suite**

Run: `pnpm test`
Expected: all tests pass, zero skipped.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: zero errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: zero errors. (If ESLint config isn't present yet, add a minimal `.eslintrc.cjs` with `@typescript-eslint/recommended` and re-run.)

- [ ] **Step 4: Audit for dead code — user's explicit requirement**

Run:
```bash
pnpm dlx ts-prune --error
```

Expected: zero unused exports reported. For every item reported:
- If it's a re-export that's part of the public API (e.g., `src/daemon.ts` re-exports), keep it and annotate with `// ts-prune-ignore-next` above it.
- If it's used only from tests, keep the export.
- If it's genuinely unreferenced, **delete the symbol and re-run** `pnpm test && pnpm typecheck`. Both must still pass.

Also verify the daemon's startup path transitively pulls every adapter:

```bash
pnpm build
node -e "import('./dist/mcp/server.js').then(() => console.log('wire check ok'))"
```

Expected output: `wire check ok`, and no "cannot find module" errors. This proves every adapter, tool, and utility is actually imported by the main runtime.

- [ ] **Step 5: Write `README.md`**

```markdown
# ide-bridge

Cross-IDE context bridge over MCP. Lets Claude Code, Cursor, Kiro, and Antigravity share a Portable Context Bundle so you can pick up where you left off when you switch IDEs.

## Install

```bash
pnpm i -g ide-bridge
ide-bridge install-service   # optional: run on login
ide-bridge start              # foreground
```

## Configure your IDE

```bash
# In your project root:
ide-bridge init                     # writes .ide-bridge.yaml (checked in)
ide-bridge priming claude-code      # adds bridge section to CLAUDE.md
ide-bridge priming cursor           # writes .cursor/rules/ide-bridge.mdc
ide-bridge priming kiro             # writes .kiro/steering/ide-bridge.md
ide-bridge priming antigravity      # writes AGENTS.md
```

Point each IDE's MCP config at `http://127.0.0.1:31415/mcp`.

## Docs

See [docs/superpowers/specs/2026-04-17-mcp-ide-bridge-design.md](docs/superpowers/specs/2026-04-17-mcp-ide-bridge-design.md) for the full design spec.
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: v0.1 README with install and priming commands"
```

---

## Self-review (in-plan)

- **Spec coverage.** Every v0.1 milestone item from spec §13 has at least one task: daemon + 6 tools (Tasks 16, 17), file-backed PCB store (Task 6), Claude Code L3 adapter + forged-session requirement (Task 12, spec §15 #4), Cursor L2 adapter (Task 13), Kiro L1 adapter (Task 14), Antigravity L0-L1 adapter (Task 15), generic fallback (Task 11), identity resolver with 3-tier priority (Task 8, spec §7), 30s save debounce (Task 9, spec §8), install script + launchd/systemd + CLI (Tasks 18-19), priming files for each IDE (Task 20), extractive summary (Task 4, spec §15 #5), `.ide-bridge.yaml` checked-in by default (Task 18 step 6, spec §15 #3), default port 31415 with fallback probe (Tasks 17-18, spec §15 #1), binary named `ide-bridge` (Task 1 package.json, spec §15 #2). End-to-end acceptance (spec §14 criterion 1-2) is Task 21. Zero-auth / no network egress (§14 criterion 6) is guaranteed by the daemon binding only `127.0.0.1` (Task 17 step 5).

- **Placeholder scan.** No "TBD", "TODO", "similar to". Every code step shows complete code. Task 18 deliberately creates throwing stubs for `install_service.ts` and `priming.ts`; Tasks 19 and 20 overwrite them and their tests fail if the stubs survive. Task 22's dead-code audit (`ts-prune --error`) is the second line of defense against the user's "no dead code" requirement.

- **Type consistency.** `Pcb`, `PcbPatch`, `IdeAdapter`, `ImportReport`, `BundleStore`, `HistoryEntry`, `Fidelity`, `Resolved`, `Handle`, `StartOpts`, `Deps` — each defined once and used the same way everywhere. Tool names (`save_checkpoint`, `load_checkpoint`, `append_decision`, `append_todo`, `list_projects`, `get_project_id`) match spec §6 one-to-one. Adapter `ide` strings (`claude-code`, `cursor`, `kiro`, `antigravity`, `generic`) match priming generator routes and spec §9 case-sensitively.

- **"No dead code" guardrail.** Every source file is transitively imported from `src/index.ts` → CLI commands → `startMcpServer` → `buildToolHandlers` + adapter registry (all 5 adapters) + store + identity + util. Task 22 Step 4 runs `ts-prune --error` and a wire-import smoke check that fails the build if a module becomes unreferenced.
