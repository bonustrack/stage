export interface HomeEmptyActionModel {
  title: string;
  body: string;
  startLabel: string;
  addressLabel: string | undefined;
  addressHint: string | undefined;
}

function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function homeEmptyActionModel(address: string | null | undefined): HomeEmptyActionModel {
  return {
    title: 'No conversations yet',
    body: 'Start a conversation or tap your address to share it.',
    startLabel: 'Start new conversation',
    addressLabel: address ? shortAddress(address) : undefined,
    addressHint: address ? 'Tap to copy' : undefined,
  };
}
