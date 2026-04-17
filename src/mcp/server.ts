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
import type { BundleStore } from "../store/types.js";

export interface StartOpts {
  port: number;
  store?: BundleStore;
  debouncer?: Debouncer;
  adapters?: AdapterRegistry;
}
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
  const adapters = opts.adapters ?? (() => {
    const r = new AdapterRegistry();
    [claudeCodeAdapter, cursorAdapter, kiroAdapter, antigravityAdapter, genericAdapter]
      .forEach(a => r.register(a));
    return r;
  })();
  const handlers = buildToolHandlers({
    store: opts.store ?? new FileBundleStore(),
    debouncer: opts.debouncer ?? new Debouncer(30_000),
    adapters,
  });

  const app: FastifyInstance = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 });

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
