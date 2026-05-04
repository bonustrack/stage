#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// Load .env from the package root (next to package.json) so the server works
// regardless of the cwd it was spawned with. Real env vars take precedence.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// Modules read TELEGRAM_BOT_TOKEN at import time, so wait until after env load.
const { getMe, startPolling } = await import("./telegram.js");
const { handleOAuth, lookupToken } = await import("./oauth.js");
const { buildServer, runWithUser } = await import("./mcp.js");

const HTTP_PORT = process.env.MCP_HTTP_PORT || process.env.PORT;

if (HTTP_PORT) {
  // ----- HTTP transport: multi-tenant, OAuth-protected -----
  const me = await getMe();
  const botUsername = me.username;
  if (!botUsername) {
    console.error("metro-mcp: bot has no username — set one in @BotFather before running in HTTP mode");
    process.exit(1);
  }
  await startPolling();

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  };
  const withCors = (res: Response) => {
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
    return res;
  };

  // OAuth metadata `issuer` must be stable, so prefer METRO_BASE_URL. Fall
  // back to per-request Host derivation, which works behind most proxies.
  function baseUrlFor(req: Request): string {
    if (process.env.METRO_BASE_URL) return process.env.METRO_BASE_URL.replace(/\/$/, "");
    const url = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    return `${proto}://${host}`;
  }

  Bun.serve({
    port: Number(HTTP_PORT),
    async fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return withCors(new Response("ok"));
      }

      // OAuth routes (metadata, /register, /authorize, /oauth/status, /token).
      const baseUrl = baseUrlFor(req);
      const oauthResp = await handleOAuth(req, baseUrl, botUsername);
      if (oauthResp) return withCors(oauthResp);

      // Everything else is the MCP transport — gated by bearer token.
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const record = token ? lookupToken(token) : null;
      if (!record) {
        const wwwAuth = `Bearer realm="metro", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
        return withCors(
          new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32001, message: "unauthorized" },
              id: null,
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json", "WWW-Authenticate": wwwAuth },
            },
          ),
        );
      }

      // Stateless: a fresh transport+server per request. Tool handlers close
      // over the shared polling/waiters state, so this only costs an in-memory
      // tool-registration pass (sub-ms).
      return await runWithUser({ chat_id: record.chat_id, user_name: record.user_name }, async () => {
        const transport = new WebStandardStreamableHTTPServerTransport({});
        const reqServer = buildServer();
        await reqServer.connect(transport);
        return withCors(await transport.handleRequest(req));
      });
    },
  });
  console.error(
    `metro-mcp: HTTP transport listening on :${HTTP_PORT} as @${botUsername} (OAuth 2.1 required)`,
  );
} else {
  // ----- stdio transport: single-tenant, env-configured -----
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.error("metro-mcp: TELEGRAM_CHAT_ID env var is required for stdio mode");
    process.exit(1);
  }
  const stdioServer = buildServer();
  await runWithUser({ chat_id: chatId, user_name: "user" }, () =>
    stdioServer.connect(new StdioServerTransport()),
  );
}
