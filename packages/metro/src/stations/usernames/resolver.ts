// CCIP-Read (EIP-3668) gateway resolution for the Stage offchain resolver.
//
// The on-chain `OffchainResolver` (contracts/OffchainResolver.sol) reverts with
// OffchainLookup pointing here; the client re-requests GET <gw>/{sender}/{data}
// or POST <gw>/ {sender,data} where `data` is the ABI-encoded
// IResolverService.resolve(bytes dnsName, bytes encodedResolverCall).
//
// This module: decodes the outer call → (dnsName, innerCall); decodes the
// DNS-encoded name → label (strip `.stage.eth`); decodes the inner ENS resolver
// call (addr / addr(coin) / text(avatar)); looks up the record, ABI-encodes the
// answer; and signs it per the offchain-resolver scheme so the contract's
// callback verifies the gateway signer.
//
// Signing key: METRO_USERNAMES_SIGNER_KEY (0x-hex private key). Its address must
// match a `signer` configured in the deployed OffchainResolver.

import {
  type Address, type Hex, encodeAbiParameters,
  encodeFunctionResult, decodeFunctionData, keccak256, parseAbi,
  encodePacked, hexToBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getByName } from './store.js';
import { STAGE_PARENT } from './username-spec.js';

/** Outer gateway service ABI (offchain-resolver `IResolverService`). */
const SERVICE_ABI = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes result, uint64 expires, bytes sig)',
]);

/** Subset of the ENS resolver profile we answer. */
const RESOLVER_ABI = parseAbi([
  'function addr(bytes32 node) view returns (address)',
  'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
  'function text(bytes32 node, string key) view returns (string)',
]);

const ETH_COIN_TYPE = 60n;
/** Answers stay fresh for this long; the contract checks `expires`. */
const TTL_SECONDS = 300n;

/** Decode a DNS-wire name (length-prefixed labels, null-terminated) to dotted. */
function decodeDnsName(dns: Hex): string {
  const bytes = hexToBytes(dns);
  const labels: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i++];
    if (!len) break;
    labels.push(new TextDecoder().decode(bytes.slice(i, i + len)));
    i += len;
  }
  return labels.join('.');
}

/** Extract the label (everything before `.stage.eth`). Returns '' if the name
 *  is the apex or not under stage.eth. */
function labelOf(dotted: string): string {
  const suffix = `.${STAGE_PARENT}`;
  return dotted.endsWith(suffix) ? dotted.slice(0, -suffix.length) : '';
}

/** Resolve + sign one CCIP-Read request. `resolverAddr` is the on-chain
 *  OffchainResolver address (the EIP-712-ish digest binds the sig to it). */
export async function handleResolve(
  resolverAddr: Address,
  outerData: Hex,
  signerKey: Hex,
): Promise<{ result: Hex; expires: bigint; sig: Hex }> {
  const { args } = decodeFunctionData({ abi: SERVICE_ABI, data: outerData });
  const [dnsName, innerData] = args as [Hex, Hex];
  const label = labelOf(decodeDnsName(dnsName));
  const rec = label ? await getByName(label) : null;

  const inner = decodeFunctionData({ abi: RESOLVER_ABI, data: innerData });
  let result: Hex;
  if (inner.functionName === 'addr' && inner.args.length === 1) {
    const addr = (rec?.address ?? '0x0000000000000000000000000000000000000000') as Address;
    result = encodeFunctionResult({ abi: RESOLVER_ABI, functionName: 'addr', result: addr });
  } else if (inner.functionName === 'addr') {
    const coin = inner.args[1] as bigint;
    const bytes: Hex = coin === ETH_COIN_TYPE && rec ? (rec.address as Hex) : '0x';
    result = encodeAbiParameters([{ type: 'bytes' }], [bytes]);
  } else {
    // text(node, key): only `avatar` is populated.
    const key = inner.args[1] as string;
    const val = key === 'avatar' ? rec?.avatar ?? '' : '';
    result = encodeAbiParameters([{ type: 'string' }], [val]);
  }

  const expires = BigInt(Math.floor(Date.now() / 1000)) + TTL_SECONDS;
  const sig = await signResponse(resolverAddr, expires, outerData, result, signerKey);
  return { result, expires, sig };
}

/** offchain-resolver signing digest:
 *  keccak256(0x1900 ++ resolver ++ expires(uint64) ++ keccak256(request) ++
 *            keccak256(result)), signed as a raw 65-byte secp256k1 signature. */
async function signResponse(
  resolver: Address, expires: bigint, request: Hex, result: Hex, key: Hex,
): Promise<Hex> {
  const digest = keccak256(encodePacked(
    ['bytes2', 'address', 'uint64', 'bytes32', 'bytes32'],
    ['0x1900', resolver, expires, keccak256(request), keccak256(result)],
  ));
  const account = privateKeyToAccount(key);
  // Sign the digest directly (no EIP-191 prefix) — matches SignatureVerifier.sol.
  return account.sign({ hash: digest });
}

/** ABI-encode the gateway's `(result, expires, sig)` tuple the client returns to
 *  the contract's callback. */
export function encodeGatewayResponse(result: Hex, expires: bigint, sig: Hex): Hex {
  return encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'uint64' }, { type: 'bytes' }],
    [result, expires, sig],
  );
}

/** The signer address for the configured key (logged at boot for the contract). */
export function signerAddress(key: Hex): Address {
  return privateKeyToAccount(key).address;
}
