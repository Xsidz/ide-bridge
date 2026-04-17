import pino from "pino";
export const logger = pino({ level: process.env.IDE_BRIDGE_LOG_LEVEL ?? "info" });
