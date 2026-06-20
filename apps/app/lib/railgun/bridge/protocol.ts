/** @file Local re-export of the framework-agnostic nodejs-mobile bridge wire-protocol types (BridgeCall/BridgeEvent/params/results) from `@stage-labs/client/railgun`, keeping `./protocol` import sites stable. */

/** Thin re-export of the framework-agnostic nodejs-mobile bridge wire contract from @stage-labs/client/railgun, kept local so `./protocol` import sites stay unchanged; RailgunNet is the 'sepolia' | 'mainnet' union the host maps to the SDK NetworkName. */
export type {
  RailgunNet,
  BridgeCall,
  BridgeEvent,
  CallParams,
  CallResult,
} from '@stage-labs/client/railgun';
