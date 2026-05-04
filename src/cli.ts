#!/usr/bin/env bun
// metro CLI: small client for the Metro MCP server. Two subcommands:
//
//   metro login   Run the OAuth 2.1 / PKCE flow against $METRO_BASE_URL,
//                 print Bearer access token to stdout when done. Pipe into
//                 `read` or capture to a shell var; the token is the only
//                 stdout output, all UI goes to stderr.
//
//   metro inbox   Long-running daemon: open the OAuth-protected /inbox SSE
//                 stream and emit one JSON line per inbound Telegram
//                 message. Designed to be spawned as a background process
//                 by an agent (e.g. Claude Code via `Bash run_in_background`
//                 + Monitor) so messages surface at the next agent decision
//                 boundary without polling.
//
// Config (env): METRO_BASE_URL defaults to the hosted instance; override
// for a self-hosted server. METRO_TOKEN is required for `metro inbox` —
// run `metro login` to mint one.

export {};

const DEFAULT_BASE_URL = "https://mcp.bonustrack.co";
const BASE_URL = (process.env.METRO_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

const argv = process.argv.slice(2);
const cmd = argv[0];

if (cmd === "login") {
  await runLogin(BASE_URL);
  process.exit(0);
} else if (cmd === "inbox") {
  await runInbox(BASE_URL);
} else {
  console.error("usage: metro <login|inbox>");
  process.exit(cmd ? 1 : 0);
}

// ---- login ----------------------------------------------------------------

async function runLogin(baseUrl: string): Promise<void> {
  // 1) register a CLI client. redirect_uri is required by /authorize but
  // never used: we poll /oauth/status instead of accepting a redirect, and
  // /token doesn't enforce a redirect_uri match.
  const REDIRECT = "urn:ietf:wg:oauth:2.0:oob";
  const reg = await postJson(`${baseUrl}/register`, {
    client_name: "metro-cli",
    redirect_uris: [REDIRECT],
  });
  const client_id: string = reg.client_id;

  // 2) PKCE: keep the verifier secret, hash it for the challenge.
  const verifier = randomB64Url(32);
  const challenge = await sha256B64Url(verifier);
  const state = randomB64Url(12);

  // 3) ask /authorize (JSON variant) for an auth_request id + Telegram
  // deep link. The CLI relays the link to the user; the server is already
  // listening for /start <id> on the bot.
  const authUrl = new URL(`${baseUrl}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", REDIRECT);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  const authRes = await fetch(authUrl, { headers: { Accept: "application/json" } });
  if (!authRes.ok) {
    console.error(`metro: /authorize failed: ${authRes.status} ${await authRes.text()}`);
    process.exit(1);
  }
  const auth = (await authRes.json()) as { id: string; deep_link: string; expires_at: number };

  console.error(`\nOpen this link in Telegram and tap START:\n\n  ${auth.deep_link}\n`);
  console.error("Waiting for confirmation…");

  // 4) poll /oauth/status until completed (or expired).
  const deadline = Date.now() + 10 * 60 * 1000; // 10 min, matches server TTL
  let code: string | null = null;
  while (Date.now() < deadline) {
    await sleep(2000);
    const r = await fetch(`${baseUrl}/oauth/status?id=${encodeURIComponent(auth.id)}`);
    if (!r.ok) continue;
    const j = (await r.json()) as { status: string; redirect?: string };
    if (j.status === "completed" && j.redirect) {
      const u = new URL(j.redirect);
      code = u.searchParams.get("code");
      break;
    }
    if (j.status === "expired") {
      console.error("metro: authorization link expired before confirmation");
      process.exit(1);
    }
  }
  if (!code) {
    console.error("metro: timed out waiting for authorization");
    process.exit(1);
  }

  // 5) exchange code → access token.
  const tokenRes = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id,
    }),
  });
  if (!tokenRes.ok) {
    console.error(`metro: /token failed: ${tokenRes.status} ${await tokenRes.text()}`);
    process.exit(1);
  }
  const tok = (await tokenRes.json()) as { access_token: string };
  console.error("\n✓ authorized\n");
  process.stdout.write(tok.access_token + "\n");
}

// ---- inbox ----------------------------------------------------------------

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };
type InboxMessage = { message_id: number; date: number; content: ContentBlock[] };

function summarize(msg: InboxMessage): Record<string, unknown> {
  const out: Record<string, unknown> = { message_id: msg.message_id, date: msg.date };
  const texts: string[] = [];
  const images: string[] = [];
  for (const b of msg.content) {
    if (b.type === "text") texts.push(b.text);
    else if (b.type === "image") images.push(b.mimeType);
  }
  if (texts.length) out.text = texts.join("\n");
  if (images.length) out.images = images;
  return out;
}

// Parse an SSE stream from a Response body. Yields one parsed message per
// `event: message` block. Tolerates comment lines (heartbeats) and ignores
// unknown event types.
async function* parseSSE(res: Response): AsyncGenerator<InboxMessage> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (!line || line.startsWith(":")) continue;
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^\s/, ""));
        }
        if (event !== "message" || dataLines.length === 0) continue;
        try {
          yield JSON.parse(dataLines.join("\n")) as InboxMessage;
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function runInbox(baseUrl: string): Promise<void> {
  const TOKEN = process.env.METRO_TOKEN ?? "";
  if (!TOKEN) {
    console.error("metro: METRO_TOKEN is required (run `metro login` to obtain one)");
    process.exit(1);
  }
  let backoffMs = 500;
  const MAX_BACKOFF_MS = 30_000;
  while (true) {
    try {
      const res = await fetch(`${baseUrl}/inbox`, {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: "text/event-stream" },
      });
      if (res.status === 401) {
        console.error("metro: 401 unauthorized — token rejected; exiting");
        process.exit(2);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      backoffMs = 500;
      for await (const msg of parseSSE(res)) {
        process.stdout.write(JSON.stringify(summarize(msg)) + "\n");
      }
    } catch (err: any) {
      console.error(`metro: ${err?.message ?? err} — retrying in ${backoffMs}ms`);
    }
    await sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }
}

// ---- helpers --------------------------------------------------------------

async function postJson(url: string, body: unknown): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    console.error(`metro: POST ${url} failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  return r.json();
}

function randomB64Url(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256B64Url(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
