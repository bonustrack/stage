import {
  DEFAULT_CHANNEL_FIELDS, parseChannelFields, toggleChannelFieldIn,
  type ChannelField, type ChannelFields, type ChannelFieldView,
} from '../components/home/fields.model';
import { appStorage } from '../platform/storage';
import { reported } from './errorPolicy';
import { createValueStore } from './persistedStore';

const prefs = createValueStore({
  key: 'home.fields.', default: DEFAULT_CHANNEL_FIELDS, deserialize: parseChannelFields, serialize: JSON.stringify, perAccount: true,
  storage: {
    get: async (key) => {
      const raw = await appStorage.get(key);
      const avatars = await appStorage.get('channels.avatars');
      return JSON.stringify(parseChannelFields(raw ?? '{}', avatars !== '0'));
    },
    set: appStorage.set,
  },
});

export function useChannelFields(view: ChannelFieldView): ChannelFields {
  return prefs.use()[view];
}

export function toggleChannelField(view: ChannelFieldView, field: ChannelField): void {
  void prefs.update(current => toggleChannelFieldIn(current, view, field)).catch(reported('channelFields.save'));
}
