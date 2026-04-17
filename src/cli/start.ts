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
