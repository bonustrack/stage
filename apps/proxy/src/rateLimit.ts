import { clientIp } from '@stage-labs/client/net/clientIp';

const WINDOW_MS = 60_000;
const BUDGET_MAX = 60;
const hits = new Map<string, { count: number; reset: number }>();

export type RateBudget = 'preview' | 'img' | 'settle' | 'history' | 'names' | 'attachments' | 'nodes';

export interface EdgeLimit {
  binding: RateLimit | undefined;
  key: string;
}

export interface RouteLimit<Env> {
  budget?: RateBudget;
  methods?: readonly string[];
  edge?: (env: Env, ip: string) => readonly EdgeLimit[];
  inHandler?: boolean;
}

function overBudget(budget: RateBudget, ip: string): boolean {
  const key = `${budget}:${ip}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > BUDGET_MAX;
}

export async function overLimit<Env>(limit: RouteLimit<Env> | undefined, request: Request, env: Env): Promise<boolean> {
  if (limit === undefined) return false;
  const ip = clientIp(request.headers);
  if (limit.budget !== undefined && overBudget(limit.budget, ip)) return true;
  for (const { binding, key } of limit.edge?.(env, ip) ?? []) {
    if (binding !== undefined && !(await binding.limit({ key })).success) return true;
  }
  return false;
}

export function limitsAtRouter<Env>(limit: RouteLimit<Env> | undefined, method: string): boolean {
  if (limit === undefined || limit.inHandler === true) return false;
  return limit.methods === undefined || limit.methods.includes(method);
}
