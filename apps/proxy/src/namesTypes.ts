import type { Hex } from 'viem';

export interface NamesChain {
  operator: Hex;
  verifyClaim(address: Hex, message: string, signature: Hex): Promise<boolean>;
  subnameOwner(label: string): Promise<Hex | null>;
  issue(label: string, owner: Hex): Promise<Hex>;
}

export interface NamesStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface NamesDeps {
  chain: NamesChain;
  store: NamesStore;
  now?: () => number;
}
