/** Stage SDK barrel: the `createStageClient` factory, its client/module types,
 *  and the dependency-inversion interfaces hosts implement. */

export { createStageClient } from './client';
export type { StageClient, IdentityModule, ApiModule, WalletModule } from './client';
export type {
  Storage,
  SecureStorage,
  SignerTransport,
  MessagingTransport,
  RailgunTransport,
  Eip712TypedData,
  TxRequest,
  StageEnv,
  StageApiKeys,
  StageClientOptions,
} from './interfaces';
