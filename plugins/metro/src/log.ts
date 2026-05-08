// Pino → stderr. Stdout is reserved for MCP JSON-RPC; any stray write there
// breaks the protocol. Override level with METRO_LOG_LEVEL.

import pino from "pino";

export const log = pino(
  { name: "metro", level: process.env.METRO_LOG_LEVEL || "info" },
  pino.destination(2),
);
