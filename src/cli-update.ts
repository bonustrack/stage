/** `metro update` — npm registry lookup + in-place global install. */

import { spawn } from 'node:child_process';
import pkg from '../package.json' with { type: 'json' };

export type UpdateFlags = { json: boolean };

const emit = (json: boolean, human: string, structured: unknown): void => {
  process.stdout.write(json ? JSON.stringify(structured) + '\n' : human + '\n');
};

export async function cmdUpdate(json: boolean): Promise<void> {
  const tag = pkg.version.includes('-') ? 'beta' : 'latest';
  const res = await fetch('https://registry.npmjs.org/@stage-labs/metro', { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`npm registry: ${res.status}`);
  const latest = ((await res.json()) as { 'dist-tags'?: Record<string, string> })['dist-tags']?.[tag];
  if (!latest) throw new Error(`no '${tag}' dist-tag for @stage-labs/metro`);
  if (latest === pkg.version) return emit(json, `already on ${pkg.version} (latest ${tag})`, { ok: true, current: pkg.version, latest, upgraded: false });

  const argv1 = process.argv[1] ?? '', spec = `@stage-labs/metro@${tag}`;
  const argv = argv1.includes('/.bun/') || argv1.includes('\\bun\\') ? ['bun', 'add', '-g', spec]
    : argv1.includes('/pnpm/') || argv1.includes('\\pnpm\\') ? ['pnpm', 'add', '-g', spec]
    : ['npm', 'install', '-g', spec];
  emit(json, `metro ${pkg.version} → ${latest}\n$ ${argv.join(' ')}`, { ok: true, current: pkg.version, latest, command: argv.join(' ') });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: json ? 'ignore' : 'inherit' });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${argv[0]} exited ${code}`)));
    child.on('error', reject);
  });
}
