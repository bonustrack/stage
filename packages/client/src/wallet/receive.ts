export type ReceiveMode = 'public' | 'private';

export interface ReceiveViewModelInputs {
  mode: ReceiveMode;
  publicAddress: string;
  privateAddress: string;
  privateReady: boolean;
}

export interface ReceiveViewModel {
  activeMode: ReceiveMode;
  address: string;
  label: string;
  hint: string;
}

const PUBLIC_LABEL = 'Wallet address (tap to copy)';
const PRIVATE_LABEL = 'Shielded 0zk address (tap to copy)';
const PUBLIC_HINT = 'Scan or share this address to receive ETH or tokens on Ethereum mainnet.';
const PRIVATE_HINT =
  'Shielded address. Funds sent here are private — the sender shields into Railgun.';

export function receiveViewModel({
  mode, publicAddress, privateAddress, privateReady,
}: ReceiveViewModelInputs): ReceiveViewModel {
  const activeMode: ReceiveMode = mode === 'private' && !privateReady ? 'public' : mode;
  const isPrivate = activeMode === 'private';
  return {
    activeMode,
    address: isPrivate ? privateAddress : publicAddress,
    label: isPrivate ? PRIVATE_LABEL : PUBLIC_LABEL,
    hint: isPrivate ? PRIVATE_HINT : PUBLIC_HINT,
  };
}
