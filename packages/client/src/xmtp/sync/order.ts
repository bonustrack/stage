import { z } from 'zod';
import { defineSyncKind, latestWins } from './kind';

export const boardOrderSchema = z.array(z.string().min(1));

const orderStateSchema = z.object({ order: boardOrderSchema, at: z.number().positive() });

export type OrderStateContent = z.infer<typeof orderStateSchema>;

export const BOARD_SYNC = defineSyncKind({
  typeId: 'boardState',
  schema: orderStateSchema,
  fallback: 'Stage board layout',
  replay: latestWins<OrderStateContent>(),
});

export const CATEGORY_ORDER_SYNC = defineSyncKind({
  typeId: 'categoryOrderState',
  schema: orderStateSchema,
  fallback: 'Stage category order',
  replay: latestWins<OrderStateContent>(),
});
