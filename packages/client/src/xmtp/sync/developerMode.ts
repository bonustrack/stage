import { z } from 'zod';
import { defineSyncKind, latestWins } from './kind';

export const developerModeSchema = z.object({ enabled: z.boolean(), at: z.number().finite().nonnegative() });

export type DeveloperModeContent = z.infer<typeof developerModeSchema>;

export const DEFAULT_DEVELOPER_MODE: DeveloperModeContent = { enabled: false, at: 0 };

export function mergeDeveloperMode(current: DeveloperModeContent, incoming: DeveloperModeContent): DeveloperModeContent {
  return incoming.at > current.at || (incoming.at === current.at && !incoming.enabled) ? incoming : current;
}

export const DEVELOPER_MODE_SYNC = defineSyncKind({
  typeId: 'developerMode',
  schema: developerModeSchema,
  fallback: 'Stage developer mode',
  replay: latestWins(mergeDeveloperMode),
});
