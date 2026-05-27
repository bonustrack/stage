/** Metro public API (api.metro.box).
 *
 *  Standalone Bun HTTP server (kept out of ~/.metro/trains/ so the metro daemon
 *  doesn't supervise/restart it — avoids bouncing the other trains). It shells
 *  `metro call xmtp newGroup` so the *daemon* creates the group: the daemon is
 *  the super-admin/owner and the requesting user joins as a plain member.
 *
 *  Endpoints:
 *    GET  /health                     → "ok"
 *    POST /ask-question { address }   → { conversationId, line }  (daemon-owned group)
 */

const PORT = Number(process.env.METRO_API_PORT ?? '8500');

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Run the daemon's xmtp `newGroup` action via the metro CLI and pull the
 *  created group's id/line out of its stdout (which may carry extra log lines). */
async function createDaemonOwnedGroup(address: string, name: string): Promise<{ id: string; line: string }> {
  const args = JSON.stringify({ addresses: [address], name });
  const proc = Bun.spawn(['metro', 'call', 'xmtp', 'newGroup', args], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  for (const raw of out.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('{')) continue;
    try {
      const obj = JSON.parse(line) as { result?: { id?: string; line?: string }; id?: string; line?: string; error?: string };
      if (obj.error) throw new Error(obj.error);
      const r = obj.result ?? obj;
      if (r.id && r.line) return { id: r.id, line: r.line };
    } catch (e) {
      if (e instanceof SyntaxError) continue;
      throw e;
    }
  }
  throw new Error(`group creation failed: ${(err || out).slice(0, 300)}`);
}

Bun.serve({
  port: PORT,
  idleTimeout: 60,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health') return new Response('ok', { headers: CORS });

    if (req.method === 'POST' && url.pathname === '/ask-question') {
      const body = await req.json().catch(() => ({})) as { address?: string };
      const address = (body.address ?? '').trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return Response.json({ error: 'a valid 0x address is required' }, { status: 400, headers: CORS });
      }
      try {
        const group = await createDaemonOwnedGroup(address, 'Ask a question');
        return Response.json({ conversationId: group.id, line: group.line }, { headers: CORS });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 500, headers: CORS });
      }
    }
    return new Response('not found', { status: 404, headers: CORS });
  },
});

process.stderr.write(`metro api-server listening on :${PORT}\n`);
