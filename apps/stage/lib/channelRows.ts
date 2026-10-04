import { createValueStore } from './persistedStore';

const avatars = createValueStore<boolean>({
  key: 'channels.avatars',
  default: true,
  serialize: (on) => (on ? '1' : '0'),
  deserialize: (raw) => raw !== '0',
});

export const useChannelAvatars = (): boolean => avatars.use();

export function setChannelAvatars(on: boolean): void { avatars.set(on); }
