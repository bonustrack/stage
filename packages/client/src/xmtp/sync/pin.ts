import { z } from 'zod';
import { defineSyncKind, inTime } from './kind';

const pinStateSchema = z.object({
  convId: z.string().min(1),
  pinned: z.boolean(),
  at: z.number().positive(),
  order: z.array(z.string().min(1)).optional(),
});

export type PinStateContent = z.infer<typeof pinStateSchema>;

function pinsSinceLastOrder(states: readonly PinStateContent[], maxAt: number): PinStateContent[] {
  const pins = inTime(states, maxAt).sort((a, b) => a.at - b.at);
  const lastOrder = pins.map((p) => p.order !== undefined).lastIndexOf(true);
  return lastOrder === -1 ? pins : pins.slice(lastOrder);
}

export const PIN_SYNC = defineSyncKind({
  typeId: 'pinState',
  schema: pinStateSchema,
  fallback: 'Stage pin state',
  replay: pinsSinceLastOrder,
});
