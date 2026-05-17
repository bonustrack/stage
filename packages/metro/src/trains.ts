/** Train supervisor + protocol — re-export facade. Implementation lives under ./trains/. */

export { TrainSupervisor, TRAINS_DIR, type TrainInfo } from './trains/supervisor.js';
export { type TrainEvent, type TrainCallResponse } from './trains/protocol.js';
