export type WalletTab = 'tokens' | 'nfts' | 'activity';

export const WALLET_TABS: { id: WalletTab; label: string }[] = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'nfts', label: 'NFTs' },
  { id: 'activity', label: 'Activity' },
];
