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
