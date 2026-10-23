import { z } from 'zod';

export const developerModeSchema = z.object({ enabled: z.boolean(), at: z.number().finite().nonnegative() });

export type DeveloperModeContent = z.infer<typeof developerModeSchema>;

export const DEFAULT_DEVELOPER_MODE: DeveloperModeContent = { enabled: false, at: 0 };

export function mergeDeveloperMode(current: DeveloperModeContent, incoming: DeveloperModeContent): DeveloperModeContent {
  return incoming.at > current.at || (incoming.at === current.at && !incoming.enabled) ? incoming : current;
}
