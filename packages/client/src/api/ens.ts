
const STAMP_URL = 'https://stamp.fyi';

export async function resolveEnsName(name: string): Promise<string | null> {
  const res = await fetch(STAMP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'resolve_names',
      params: [name],
      network: 1,
    }),
  });
  if (!res.ok) throw new Error(`stamp.fyi resolve_names ${res.status}`);
  const body = (await res.json()) as { result?: Record<string, string> | null };
  const addr = body.result?.[name];
  return typeof addr === 'string' && addr.length === 42 ? addr : null;
}
