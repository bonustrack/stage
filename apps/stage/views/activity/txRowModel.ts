export type TxDirection = 'in' | 'out' | 'self';

export interface TxRowParams {
  direction: TxDirection;
  title: string;
  amount: string;
  token: string;
  timestamp: string;
  counterparty: string;
  chainLabel?: string;
  subText?: string;
  failed?: boolean;
}

export type ActivityDirection = 'send' | 'receive' | 'self';

export const TX_DIRECTION: Record<ActivityDirection, TxDirection> = {
  send: 'out',
  receive: 'in',
  self: 'self',
};

export interface TxRowDomain {
  direction: ActivityDirection;
  title: string;
  partyLabel: string;
  timeLabel: string;
  valueEth: string;
  chainLabel?: string;
  nonce: number;
  failed: boolean;
}

export interface TxRowFeatures {
  metaTime?: boolean;
}

export function txRowModel(d: TxRowDomain, features: TxRowFeatures = {}): TxRowParams {
  const meta = features.metaTime === true ? `${d.partyLabel} · ${d.timeLabel}` : d.partyLabel;
  return {
    direction: TX_DIRECTION[d.direction],
    title: d.title,
    amount: d.valueEth,
    token: 'ETH',
    timestamp: features.metaTime === true ? meta : d.timeLabel,
    counterparty: meta,
    chainLabel: d.chainLabel,
    subText: d.failed ? 'Failed' : `#${d.nonce}`,
    failed: d.failed,
  };
}
