/** SDK entry — `import { Client } from '@stage-labs/metro'`. */

export { Client, type ClientOptions, type StationInfo } from './client.js';
export {
  asLine, type ActionFn, type Envelope, type EnvelopeKind, type Line, type Station,
} from './types.js';
export type { HistoryEntry, HistoryKind } from './history.js';
