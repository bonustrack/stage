/**
 * @file OpenSea v2 helper listing the NFTs an account holds on a given chain (pure fetch).
 */
/**
 * OpenSea v2 NFT helper. Mirrors Snapshot UI's `getNfts`
 *  (~/work/sx-monorepo/apps/ui/src/helpers/opensea.ts).
 *
 *  Lists the NFTs an account holds on a given chain. The API key is a public
 *  read key (same VITE_OPENSEA_API_KEY Snapshot ships in its client bundle),
 *  not a git secret, so it lives as a plain constant here. Overridable via
 *  EXPO_PUBLIC_OPENSEA_API_KEY, or the `apiKey` arg the Stage client threads
 *  through. Pure `fetch` (uses AbortController, available in RN + browser +
 *  Node 18+).
 */

import { parseOpenseaResponse } from './opensea.schema';
import type { ApiNft } from './opensea.types';
export type { ApiNft } from './opensea.types';

const DEFAULT_KEY =
  process.env.EXPO_PUBLIC_OPENSEA_API_KEY ?? '51754bb53b324552ba4741c5b7298096';

interface ChainItem {
  name: string;
  isTestnet: boolean;
}

/** chainId -> OpenSea network slug. Subset of Snapshot's SUPPORTED_CHAIN_IDS covering the main EVM L1/L2s plus Sepolia for testing. */
const NETWORKS: Record<string, ChainItem> = {
  '1': { name: 'ethereum', isTestnet: false },
  '10': { name: 'optimism', isTestnet: false },
  '137': { name: 'matic', isTestnet: false },
  '8453': { name: 'base', isTestnet: false },
  '42161': { name: 'arbitrum', isTestnet: false },
  '43114': { name: 'avalanche', isTestnet: false },
  '11155111': { name: 'sepolia', isTestnet: true },
};

const SUPPORTED_ABIS = ['erc721', 'erc1155'];

export interface Nft {
  /** `<contract>:<identifier>` - stable key for lists. */
  id: string;
  chainId: string;
  /** Title with `#<identifier>` appended when not already present. */
  title: string;
  collection: string;
  /** Remote https image URL, or '' when the NFT has no image. */
  image: string;
  openseaUrl: string;
}

/** Fetch the NFTs `address` holds on `chainId` from OpenSea v2. Returns [] for unsupported chains or non-200 responses (caller merges across chains; one chain failing shouldn't blank the whole grid). */
export async function getNfts(
  address: string,
  chainId: string,
  apiKey: string = DEFAULT_KEY,
): Promise<Nft[]> {
  const network = NETWORKS[chainId];
  if (!network) return [];
  const { name, isTestnet } = network;

  const base = isTestnet ? 'https://testnets-api.opensea.io' : 'https://api.opensea.io';
  const url = `${base}/api/v2/chain/${name}/account/${address}/nfts`;

  // fetch has no built-in timeout; without one a hung chain request leaves
  // Promise.all (in getNftsAcrossChains) pending forever -> the NFT grid spinner
  // spins indefinitely. Abort after 10s and degrade to [] like a non-200.
  const ctrl = new AbortController();
  const timer = setTimeout(() => { ctrl.abort(); }, 10000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: ctrl.signal,
    });
  } catch {
    return []; // aborted / network error - degrade gracefully
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return []; // rate-limited / not found - degrade gracefully

  // Boundary: validate the response envelope. On drift the helper logs and
  // returns null, so we degrade to [] (matching the non-200 path) WITHOUT the
  // bad shape silently flowing through as typed data.
  const result = parseOpenseaResponse(await res.json());
  const nfts = result?.nfts ?? [];

  return nfts
    .filter(a => SUPPORTED_ABIS.includes(a.token_standard))
    .map(a => toNft(a, chainId));
}

/** Derive the display title for one OpenSea NFT, appending `#<identifier>` unless the name already carries it (or there is no token id). */
function nftTitle(a: ApiNft): string {
  const tokenId = a.identifier;
  const baseName = a.name ?? '';
  if (baseName && (/(#[0-9]+)$/.test(baseName) || !tokenId)) return baseName;
  if (tokenId) return `${baseName || a.collection || 'Untitled'} #${tokenId}`;
  return baseName || 'Untitled';
}

/** Shape one raw OpenSea NFT into the normalised Nft row the wallet grid renders. */
function toNft(a: ApiNft, chainId: string): Nft {
  return {
    id: `${a.contract}:${a.identifier}`,
    chainId,
    title: nftTitle(a),
    collection: a.collection ?? '',
    image: a.image_url ?? '',
    openseaUrl: a.opensea_url ?? '',
  };
}

/** Chains we fan out across when loading the wallet's NFT grid. */
export const NFT_CHAIN_IDS = ['1', '8453', '42161', '10', '137'];

/** Fetch + merge NFTs across `chainIds` in parallel. Per-chain failures are swallowed (getNfts returns []). */
export async function getNftsAcrossChains(
  address: string,
  chainIds: string[] = NFT_CHAIN_IDS,
  apiKey: string = DEFAULT_KEY,
): Promise<Nft[]> {
  const batches = await Promise.all(
    chainIds.map(id => getNfts(address, id, apiKey).catch(() => [] as Nft[])),
  );
  return batches.flat();
}
