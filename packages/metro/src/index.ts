/** SDK entry — `import { Client } from '@stage-labs/metro'`. */

export { Client, type ClientOptions, type StationInfo } from './client.js';
export { asLine, type ActionFn, type Envelope, type EnvelopeKind, type Station } from './types.js';
export type { HistoryEntry, HistoryKind } from './history.js';
export { mintId } from './history.js';

/** URI helpers — namespace const + `Line` type. Stations build/parse `metro://<name>/...` lines through this. */
export { Line } from './stations/index.js';

/** Webhook-station consumes these; nothing else should. */
export { handleMonitorRequest } from './monitor.js';
export { addEndpoint, findEndpoint, listEndpoints, removeEndpoint, webhookPort, type Endpoint } from './webhooks.js';
