/** nodejs-mobile bridge protocol - now a thin re-export of the framework-agnostic
 *  wire contract in @stage-labs/client/railgun. The typed request/response shapes
 *  (the pure wire protocol) live in the SDK; this binary's native channel
 *  (nodejsMobile) + the embedded Node host (nodejs-assets/) ship them. Kept as a
 *  local module so the existing `./protocol` import sites are unchanged.
 *
 *  The SDK's RailgunNet is a string union ('sepolia' | 'mainnet'), structurally
 *  identical to ../networks RailgunNet; the host maps it to the SDK NetworkName. */
export type {
  RailgunNet,
  BridgeCall,
  BridgeEvent,
  BridgeCallMap,
  CallParams,
  CallResult,
  InitParams,
  LoadProviderParams,
  CreateWalletParams,
  WalletResult,
  TokenAmountParam,
  ShieldParams,
  TransferParams,
  UnshieldParams,
  PopulatedTxResult,
  BalanceRowResult,
} from '@stage-labs/client/railgun';
