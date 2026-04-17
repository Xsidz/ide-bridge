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
