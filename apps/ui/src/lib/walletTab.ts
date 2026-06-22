export type WalletTab = 'tokens' | 'activity' | 'nfts';

export const WALLET_TABS: { id: WalletTab; label: string }[] = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'activity', label: 'Activity' },
  { id: 'nfts', label: 'NFTs' },
];
