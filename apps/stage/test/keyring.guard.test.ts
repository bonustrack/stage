
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const SCAN_DIRS = ['lib', 'app', 'components', 'modules'];
const KEYRING = join('lib', 'zerodev', 'keyring.ts');

const BANNED: { re: RegExp; label: string }[] = [
  { re: /import\s*\{[^}]*\bderiveOwner\b[^}]*\}\s*from\s*['"]@stage-labs\/client\/zerodev\/derive['"]/, label: 'deriveOwner from zerodev/derive' },
  { re: /import\s*\{[^}]*\bgenerateWalletMnemonic\b[^}]*\}\s*from\s*['"]@stage-labs\/client\/zerodev\/derive['"]/, label: 'generateWalletMnemonic from zerodev/derive' },
  { re: /import\s*\{[^}]*\b(PK_PREFIX|LEGACY_PK_KEY)\b[^}]*\}\s*from\s*['"]@stage-labs\/client\/accounts\/keys['"]/, label: 'PK storage-key constants' },
  { re: /import\s*\{[^}]*\b(privateKeyToAccount|generatePrivateKey|mnemonicToAccount|hdKeyToAccount)\b[^}]*\}\s*from\s*['"]viem\/accounts['"]/, label: 'raw-key signer from viem/accounts' },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('keyring chokepoint', () => {
  const files = SCAN_DIRS.flatMap(d => walk(join(APP_ROOT, d)));

  test('only the keyring imports private-key/mnemonic primitives', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.slice(APP_ROOT.length + 1);
      if (rel === KEYRING) continue;
      const src = readFileSync(file, 'utf8');
      for (const { re, label } of BANNED) {
        if (re.test(src)) offenders.push(`${rel}: ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the keyring actually exists and owns the primitives', () => {
    const src = readFileSync(join(APP_ROOT, KEYRING), 'utf8');
    expect(src).toContain("from 'viem/accounts'");
    expect(src).toContain('@stage-labs/client/zerodev/derive');
    expect(src).toContain('@stage-labs/client/accounts/keys');
    expect(src).toContain('export async function revealRecoveryPhrase');
    expect(src).toContain('export async function revealPrivateKey');
  });
});
