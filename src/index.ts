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
