#!/usr/bin/env node
/**
 * Deploy OffchainResolver for *.stage.eth on ETHEREUM MAINNET. READY, NOT RUN.
 *
 * Compiles OffchainResolver.sol (+ SignatureVerifier.sol) with solc and deploys
 * via viem to mainnet (chainId 1). Output: the resolver address Less sets as the
 * resolver of `stage.eth` in the ENS manager (app.ens.domains). Standard ENS
 * clients then resolve `<name>.stage.eth` via CCIP-Read off our gateway.
 *
 * Usage (from this dir):
 *   npm i solc viem            # one-off
 *   DEPLOYER_KEY=0x...         # funded mainnet deployer (needs gas) \
 *   GATEWAY_URL=https://usernames.stage.eth/{sender}/{data}.json \
 *   SIGNER_ADDRESS=0x...       # = address of METRO_USERNAMES_SIGNER_KEY \
 *   RPC_URL=https://eth.llamarpc.com   # any Ethereum mainnet RPC \
 *   node deploy.mjs
 *
 * After deploy:
 *   1. Set the printed address as the resolver of stage.eth (app.ens.domains).
 *   2. Set METRO_USERNAMES_RESOLVER + METRO_USERNAMES_SIGNER_KEY in the gateway env.
 *   3. Point the cloudflared tunnel host at the gateway and confirm GATEWAY_URL.
 */

import solc from 'solc';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWalletClient, createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, f), 'utf8');

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const GATEWAY_URL = process.env.GATEWAY_URL;
const SIGNER_ADDRESS = process.env.SIGNER_ADDRESS;
const RPC_URL = process.env.RPC_URL;
if (!DEPLOYER_KEY || !GATEWAY_URL || !SIGNER_ADDRESS || !RPC_URL) {
  console.error('Set DEPLOYER_KEY, GATEWAY_URL, SIGNER_ADDRESS, RPC_URL');
  process.exit(1);
}

const input = {
  language: 'Solidity',
  sources: {
    'SignatureVerifier.sol': { content: read('SignatureVerifier.sol') },
    'OffchainResolver.sol': { content: read('OffchainResolver.sol') },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
for (const e of out.errors ?? []) {
  if (e.severity === 'error') { console.error(e.formattedMessage); process.exit(1); }
}
const c = out.contracts['OffchainResolver.sol'].OffchainResolver;
const abi = c.abi;
const bytecode = `0x${c.evm.bytecode.object}`;

const account = privateKeyToAccount(DEPLOYER_KEY);
const transport = http(RPC_URL);
const wallet = createWalletClient({ account, transport, chain: mainnet });
const pub = createPublicClient({ transport, chain: mainnet });

console.log('Deploying OffchainResolver to Ethereum mainnet from', account.address);
const hash = await wallet.deployContract({
  abi, bytecode, args: [GATEWAY_URL, [SIGNER_ADDRESS]], chain: mainnet,
});
console.log('tx', hash);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log('\nOffchainResolver deployed at:', receipt.contractAddress);
console.log('→ set this as the resolver of stage.eth in the ENS manager (app.ens.domains).');
