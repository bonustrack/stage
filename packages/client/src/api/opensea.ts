
import { parseOpenseaResponse } from './opensea.schema';
import type { ApiNft } from './opensea.types';
export type { ApiNft } from './opensea.types';

const DEFAULT_KEY =
  process.env.EXPO_PUBLIC_OPENSEA_API_KEY ?? '51754bb53b324552ba4741c5b7298096';

interface ChainItem {
  name: string;
  isTestnet: boolean;
}

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
  id: string;
  chainId: string;
  title: string;
  collection: string;
  image: string;
  openseaUrl: string;
}

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

  const ctrl = new AbortController();
  const timer = setTimeout(() => { ctrl.abort(); }, 10000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: ctrl.signal,
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return [];

  const result = parseOpenseaResponse(await res.json());
  const nfts = result?.nfts ?? [];

  return nfts
    .filter(a => SUPPORTED_ABIS.includes(a.token_standard))
    .map(a => toNft(a, chainId));
}

function nftTitle(a: ApiNft): string {
  const tokenId = a.identifier;
  const baseName = a.name ?? '';
  if (baseName && (/(#[0-9]+)$/.test(baseName) || !tokenId)) return baseName;
  if (tokenId) return `${baseName || a.collection || 'Untitled'} #${tokenId}`;
  return baseName || 'Untitled';
}

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

export const NFT_CHAIN_IDS = ['1', '8453', '42161', '10', '137'];

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
