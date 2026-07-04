import type { PayloadHandlers } from '@stage-labs/kit/kit';
import type { Capabilities } from './capabilities';
import { LINK_OPEN } from './actions';

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function openUrlAction(
  caps: Capabilities,
  actionType: string = LINK_OPEN,
  urlKey = 'url',
): PayloadHandlers {
  return {
    [actionType]: (payload): void => {
      const url = payloadString(payload, urlKey);
      if (url) caps.openUrl(url);
    },
  };
}
