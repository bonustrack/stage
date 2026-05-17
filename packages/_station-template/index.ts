/** Skeleton — copy this folder to `packages/<name>-station/`, flip `metroStation` to true. */

import type { Station } from '@stage-labs/metro';

const station: Station = {
  name: 'template',

  configured: () => false,

  async start(_emit) { /* connect upstream, then call _emit(envelope) per inbound */ },

  async stop() { /* drop resources */ },

  actions: {
    /* Each action: async ({...args}) => result. Add only what your platform exposes. */
  },
};

export default station;
