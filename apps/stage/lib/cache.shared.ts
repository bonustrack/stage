export class MemoryStore<K, V> {
  private readonly map = new Map<K, V>();
  private readonly keyed = new Map<K, Set<(v: V | undefined) => void>>();
  private readonly global = new Set<(key: K, v: V | undefined) => void>();

  get(key: K): V | undefined { return this.map.get(key); }
  has(key: K): boolean { return this.map.has(key); }

  set(key: K, value: V): void {
    this.map.set(key, value);
    const ls = this.keyed.get(key);
    if (ls) for (const l of ls) l(value);
    for (const l of this.global) l(key, value);
  }

  subscribeAll(l: (key: K, v: V | undefined) => void): () => void {
    this.global.add(l);
    return () => { this.global.delete(l); };
  }

  subscribe(key: K, l: (v: V | undefined) => void): () => void {
    let ls = this.keyed.get(key);
    if (!ls) { ls = new Set(); this.keyed.set(key, ls); }
    ls.add(l);
    return () => { ls.delete(l); };
  }

  clear(): void {
    const keys = new Set<K>([...this.keyed.keys(), ...this.map.keys()]);
    this.map.clear();
    for (const k of keys) {
      const ls = this.keyed.get(k);
      if (ls) for (const l of ls) l(undefined);
      for (const l of this.global) l(k, undefined);
    }
  }
}
