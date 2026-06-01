/** OpenSea v2 NFT helper — mirrors Snapshot UI's `getNfts`
 *  (~/work/sx-monorepo/apps/ui/src/helpers/opensea.ts).
 *
 *  Lists the NFTs an account holds on a given chain. The API key is a public
 *  read key (same VITE_OPENSEA_API_KEY Snapshot ships in its client bundle),
 *  not a git secret — so it lives as a plain constant here, overridable via
 *  EXPO_PUBLIC_OPENSEA_API_KEY for ops that want to swap it. */

const OPENSEA_API_KEY =
  process.env.EXPO_PUBLIC_OPENSEA_API_KEY ?? '51754bb53b324552ba4741c5b7298096';

interface ChainItem {
  name: string;
  isTestnet: boolean;
}

/** chainId → OpenSea network slug. Subset of Snapshot's SUPPORTED_CHAIN_IDS
 *  covering the main EVM L1/L2s plus Sepolia for testing. */
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

interface ApiNft {
  identifier: string;
  collection: string;
  contract: string;
  token_standard: string;
  name: string;
  image_url: string;
  opensea_url: string;
}

export interface Nft {
  /** `<contract>:<identifier>` — stable key for lists. */
  id: string;
  chainId: string;
  /** Title with `#<identifier>` appended when not already present. */
  title: string;
  collection: string;
  /** Remote https image URL, or '' when the NFT has no image. */
  image: string;
  openseaUrl: string;
}

/** Fetch the NFTs `address` holds on `chainId` from OpenSea v2. Returns []
 *  for unsupported chains or non-200 responses (caller merges across chains;
 *  one chain failing shouldn't blank the whole grid). */
export async function getNfts(address: string, chainId: string): Promise<Nft[]> {
  const network = NETWORKS[chainId];
  if (!network) return [];
  const { name, isTestnet } = network;

  const base = isTestnet
    ? 'https://testnets-api.opensea.io'
    : 'https://api.opensea.io';
  const url = `${base}/api/v2/chain/${name}/account/${address}/nfts`;

  const res = await fetch(url, { headers: { 'x-api-key': OPENSEA_API_KEY } });
  if (!res.ok) return []; // rate-limited / not found — degrade gracefully

  const result = (await res.json()) as { nfts?: ApiNft[] };
  const nfts = result.nfts ?? [];

  return nfts
    .filter(a => SUPPORTED_ABIS.includes(a.token_standard))
    .map(a => {
      const tokenId = a.identifier;
      const base = a.name ?? '';
      const title =
        base && (/(#[0-9]+)$/.test(base) || !tokenId)
          ? base
          : tokenId
            ? `${base || a.collection || 'Untitled'} #${tokenId}`
            : base || 'Untitled';
      return {
        id: `${a.contract}:${tokenId}`,
        chainId,
        title,
        collection: a.collection ?? '',
        image: a.image_url ?? '',
        openseaUrl: a.opensea_url ?? '',
      };
    });
}

/** Chains we fan out across when loading the wallet's NFT grid. */
export const NFT_CHAIN_IDS = ['1', '8453', '42161', '10', '137'];

/** Fetch + merge NFTs across `chainIds` in parallel. Per-chain failures are
 *  swallowed (getNfts returns []). */
export async function getNftsAcrossChains(
  address: string,
  chainIds: string[] = NFT_CHAIN_IDS,
): Promise<Nft[]> {
  const batches = await Promise.all(
    chainIds.map(id => getNfts(address, id).catch(() => [] as Nft[])),
  );
  return batches.flat();
}
