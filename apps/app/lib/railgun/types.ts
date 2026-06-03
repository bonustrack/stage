/** Shared Railgun (private balance) types.
 *
 *  Kept tiny + UI-facing: amounts are pre-formatted decimal strings so the
 *  render path never touches bigint/wei. The on-chain/proving detail lives in
 *  the engine wrapper (engine.ts); screens only ever see these shapes. */

/** One private-token balance row, shaped to drop straight into the existing
 *  WalletScreen TokenRow renderer. */
export interface PrivateBalance {
  symbol: string;
  name: string;
  chainId: number;
  /** Decimal-string balance (formatUnits output), e.g. "1.25". */
  balance: string;
  /** Cached logo URL (stamp.fyi) so the renderer doesn't recompute. */
  logoUrl: string;
}

/** The cached private-wallet snapshot rendered INSTANTLY on open (no spinner).
 *  Refreshed in the background; `updatedAt` lets the UI show a subtle "as of"
 *  staleness hint without blocking. */
export interface PrivateSnapshot {
  /** The 0zk... shielded address for the active account. */
  zkAddress: string;
  balances: PrivateBalance[];
  /** epoch ms of the last successful background refresh. */
  updatedAt: number;
  /** True while a Merkle-tree scan is still running — the displayed amounts may
   *  fill in as the engine's balance-update callback lands. */
  scanning?: boolean;
}

/** Optimistic pending action overlaid on the cached snapshot so shield / send /
 *  unshield reflect immediately while the ~20-30s proof runs in the background. */
export interface PendingAction {
  id: string;
  kind: 'shield' | 'send' | 'unshield';
  symbol: string;
  chainId: number;
  /** Signed decimal delta applied optimistically to the matching balance row
   *  (+ for incoming shield, - for outgoing send/unshield). */
  delta: string;
  /** Coarse progress for the non-blocking indicator.
   *  `scanning` = the on-chain tx confirmed, but the Railgun merkle scan hasn't
   *  yet landed the note in the shielded balance (the slow tail of a shield). */
  phase: 'proving' | 'broadcasting' | 'scanning' | 'confirmed' | 'failed';
  /** Set once broadcast; surfaced as the explorer link. */
  txHash?: string;
  error?: string;
  startedAt: number;
}
