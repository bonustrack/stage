import {
  DEFAULT_CHANNEL_FIELDS,
  channelFieldsSchema,
  parseChannelFields,
  toggleChannelFieldIn,
  type ChannelField,
  type ChannelFields,
} from './channelFields.model';
import { appStorage } from '../platform/storage';
import { reported } from './errorPolicy';
import { createValueStore } from './persistedStore';
import type { HomeView } from './homeView';

const prefs = createValueStore({
  key: 'home.fields.',
  default: DEFAULT_CHANNEL_FIELDS,
  schema: channelFieldsSchema(DEFAULT_CHANNEL_FIELDS),
  perAccount: true,
  storage: {
    get: async (key) => {
      const raw = await appStorage.get(key);
      const avatars = await appStorage.get('channels.avatars');
      return JSON.stringify(parseChannelFields(raw ?? '{}', avatars !== '0'));
    },
    set: appStorage.set,
  },
});

export function useChannelFields(view: HomeView): ChannelFields {
  return prefs.use()[view];
}

export function toggleChannelField(view: HomeView, field: ChannelField): void {
  void prefs.update((current) => toggleChannelFieldIn(current, view, field)).catch(reported('channelFields.save'));
}
