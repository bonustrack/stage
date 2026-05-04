// OAuth 2.1 authorization server for Metro MCP.
//
// Per the MCP spec (https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
// metro is its own AS. The actual identity check is delegated to Telegram via
// a bot deep link: /authorize renders a page with `https://t.me/<bot>?start=<id>`,
// the user taps it, the bot sees /start <id>, captures their chat_id, and
// completes the authorization request. The page polls /oauth/status and
// redirects back to the client's redirect_uri once Telegram confirms.
//
// All state is in-memory: registered clients, auth requests, codes, and
// access tokens. Restarts force users to re-authorize, which is one tap.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { type ChatId, onStart, sendMessage } from "./telegram.js";

type Client = {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  registered_at: number;
};

type AuthRequest = {
  id: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: "S256";
  scope?: string;
  chat_id?: ChatId;
  user_name?: string;
  code?: string;
  code_expires_at?: number;
  created_at: number;
  status: "pending" | "completed" | "expired";
};

export type AccessToken = {
  token: string;
  chat_id: ChatId;
  user_name: string;
  client_id: string;
  issued_at: number;
};

const clients = new Map<string, Client>();
const authRequests = new Map<string, AuthRequest>();
const authCodes = new Map<string, string>(); // code → auth_request_id
const tokens = new Map<string, AccessToken>();

const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 60 * 1000;

function newId(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

function isExpired(req: AuthRequest): boolean {
  return Date.now() - req.created_at > AUTH_REQUEST_TTL_MS;
}

// Periodic cleanup so stale entries don't accumulate.
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of authRequests) {
    if (now - r.created_at > AUTH_REQUEST_TTL_MS) {
      authRequests.delete(id);
      if (r.code) authCodes.delete(r.code);
    }
  }
}, 60_000).unref?.();

// Bot deep-link completion. The polling loop in telegram.ts calls this on
// any /start <param> message; we look the param up as an auth request id.
onStart(async (m, param) => {
  const chatId: ChatId = m.chat.id;
  const r = authRequests.get(param);
  if (!r) {
    await sendMessage(chatId, "❌ Unknown or expired authorization link. Try again from your client.");
    return;
  }
  if (isExpired(r)) {
    r.status = "expired";
    await sendMessage(chatId, "❌ This authorization link has expired. Try again from your client.");
    return;
  }
  if (r.status !== "pending") {
    await sendMessage(chatId, "ℹ️ This authorization link has already been used.");
    return;
  }
  r.chat_id = chatId;
  r.user_name = m.from?.first_name ?? m.chat?.title ?? "user";
  const code = newId(32);
  r.code = code;
  r.code_expires_at = Date.now() + CODE_TTL_MS;
  r.status = "completed";
  authCodes.set(code, r.id);
  await sendMessage(
    chatId,
    `✅ Authorized as ${r.user_name}. Return to your browser to continue — Metro will use this Telegram chat from now on.`,
  );
});

export function lookupToken(token: string): AccessToken | null {
  return tokens.get(token) ?? null;
}

// Constant-time equality for opaque secrets.
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Returns a Response if `req` is an OAuth route, else null.
export async function handleOAuth(
  req: Request,
  baseUrl: string,
  botUsername: string,
): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return Response.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
    });
  }

  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return Response.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    });
  }

  if (url.pathname === "/register" && req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid_client_metadata", error_description: "body must be JSON" }, { status: 400 });
    }
    const redirect_uris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    if (redirect_uris.length === 0) {
      return Response.json(
        { error: "invalid_redirect_uri", error_description: "redirect_uris is required" },
        { status: 400 },
      );
    }
    const client: Client = {
      client_id: newId(),
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
      redirect_uris,
      registered_at: Date.now(),
    };
    clients.set(client.client_id, client);
    return Response.json({
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
  }

  if (url.pathname === "/authorize" && req.method === "GET") {
    const client_id = url.searchParams.get("client_id") ?? "";
    const redirect_uri = url.searchParams.get("redirect_uri") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const code_challenge = url.searchParams.get("code_challenge") ?? "";
    const code_challenge_method = url.searchParams.get("code_challenge_method") ?? "S256";
    const response_type = url.searchParams.get("response_type") ?? "";
    const scope = url.searchParams.get("scope") ?? undefined;
    // CLIs and other headless clients send Accept: application/json. Browsers
    // get the interactive HTML page; everyone else gets {id, deep_link} so
    // they can show the link themselves and poll /oauth/status.
    const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");

    const fail = (error: string, description: string) =>
      wantsJson
        ? Response.json({ error, error_description: description }, { status: 400 })
        : errorPage(error, description);

    if (response_type !== "code") {
      return fail("unsupported_response_type", "Only response_type=code is supported.");
    }
    const client = clients.get(client_id);
    if (!client) return fail("invalid_client", "Unknown client_id.");
    if (!client.redirect_uris.includes(redirect_uri)) {
      return fail("invalid_redirect_uri", "redirect_uri is not registered for this client.");
    }
    if (!code_challenge) return fail("invalid_request", "PKCE code_challenge is required.");
    if (code_challenge_method !== "S256") {
      return fail("invalid_request", "Only S256 PKCE method is supported.");
    }

    const id = newId();
    authRequests.set(id, {
      id,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method: "S256",
      scope,
      created_at: Date.now(),
      status: "pending",
    });

    const deepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(id)}`;
    if (wantsJson) {
      return Response.json({
        id,
        deep_link: deepLink,
        expires_at: Math.floor((Date.now() + AUTH_REQUEST_TTL_MS) / 1000),
      });
    }
    return new Response(authorizePage(deepLink, id, client.client_name), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname === "/oauth/status" && req.method === "GET") {
    const id = url.searchParams.get("id") ?? "";
    const r = authRequests.get(id);
    if (!r) return Response.json({ status: "unknown" }, { status: 404 });
    if (r.status === "completed" && r.code) {
      const params = new URLSearchParams({ code: r.code, state: r.state });
      return Response.json({
        status: "completed",
        redirect: `${r.redirect_uri}?${params.toString()}`,
        user_name: r.user_name,
      });
    }
    if (isExpired(r)) {
      r.status = "expired";
      return Response.json({ status: "expired" });
    }
    return Response.json({ status: "pending" });
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    let params: URLSearchParams;
    try {
      if (ct.includes("application/x-www-form-urlencoded")) {
        params = new URLSearchParams(await req.text());
      } else if (ct.includes("application/json")) {
        const body = (await req.json()) as Record<string, string>;
        params = new URLSearchParams(body);
      } else {
        return Response.json({ error: "invalid_request" }, { status: 400 });
      }
    } catch {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    if ((params.get("grant_type") ?? "") !== "authorization_code") {
      return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    }
    const code = params.get("code") ?? "";
    const code_verifier = params.get("code_verifier") ?? "";
    const client_id = params.get("client_id") ?? "";

    const reqId = authCodes.get(code);
    if (!reqId) return Response.json({ error: "invalid_grant" }, { status: 400 });
    const r = authRequests.get(reqId);
    if (!r || r.client_id !== client_id || r.status !== "completed") {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    if (!r.code_expires_at || Date.now() > r.code_expires_at) {
      return Response.json({ error: "invalid_grant", error_description: "code expired" }, { status: 400 });
    }
    const expected = createHash("sha256").update(code_verifier).digest("base64url");
    if (!safeEq(expected, r.code_challenge)) {
      return Response.json(
        { error: "invalid_grant", error_description: "PKCE verification failed" },
        { status: 400 },
      );
    }
    if (r.chat_id === undefined) {
      return Response.json({ error: "server_error" }, { status: 500 });
    }

    // One-time use: drop the code so it can't be replayed.
    authCodes.delete(code);

    const token = newId(32);
    tokens.set(token, {
      token,
      chat_id: r.chat_id,
      user_name: r.user_name ?? "user",
      client_id,
      issued_at: Date.now(),
    });
    return Response.json({
      access_token: token,
      token_type: "Bearer",
      scope: r.scope,
    });
  }

  return null;
}

function errorPage(error: string, description: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><title>Authorization error</title>
<style>body{font:15px/1.5 system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222}h1{font-size:1.25rem}code{background:#eee;padding:.1rem .35rem;border-radius:3px}</style>
<h1>Authorization error</h1><p><code>${escapeHtml(error)}</code></p><p>${escapeHtml(description)}</p>`;
  return new Response(html, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function authorizePage(deepLink: string, id: string, clientName?: string): string {
  const safeClient = clientName ? escapeHtml(clientName) : "this app";
  const safeId = escapeHtml(id);
  const safeLink = escapeHtml(deepLink);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Authorize Metro</title>
  <style>
    :root{color-scheme:light dark}
    body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:30rem;margin:0 auto;padding:3rem 1.25rem;text-align:center}
    h1{font-size:1.5rem;margin:0 0 .5rem}
    p{margin:.6rem 0;color:#555}
    @media (prefers-color-scheme:dark){p{color:#aaa}}
    .btn{display:inline-block;background:#229ED9;color:#fff;text-decoration:none;padding:.85rem 1.4rem;border-radius:.5rem;font-weight:600;margin:1.25rem 0}
    .btn:hover{background:#1f8fc4}
    #status{margin-top:1.5rem;font-size:.9rem;color:#888;min-height:1.5rem}
    .ok{color:#1a7f37}
    .err{color:#cf222e}
  </style>
</head>
<body>
  <h1>Connect Telegram to Metro</h1>
  <p>${safeClient} wants to send and receive messages on your behalf via the Metro bot.</p>
  <a class="btn" href="${safeLink}" target="_blank" rel="noopener">Open Telegram &amp; tap START</a>
  <p>This page will continue automatically once you confirm in the bot.</p>
  <div id="status">Waiting for Telegram…</div>
  <script>
    const id = ${JSON.stringify(safeId)};
    const status = document.getElementById("status");
    async function poll(){
      try{
        const r = await fetch("/oauth/status?id=" + encodeURIComponent(id), { cache: "no-store" });
        if (r.ok){
          const j = await r.json();
          if (j.status === "completed"){
            status.textContent = "Authorized as " + (j.user_name || "user") + ". Redirecting…";
            status.className = "ok";
            location.replace(j.redirect);
            return;
          }
          if (j.status === "expired"){
            status.textContent = "Link expired. Refresh and try again.";
            status.className = "err";
            return;
          }
        }
      } catch {}
      setTimeout(poll, 2000);
    }
    poll();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
