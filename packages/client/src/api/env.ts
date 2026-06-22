
interface ProcessLike {
  env?: Record<string, string | undefined>;
}

export function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: ProcessLike }).process;
  return proc?.env?.[name];
}
