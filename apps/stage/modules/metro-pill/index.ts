import { Platform } from 'react-native';

import nativeModule from './src/MetroPillModule';

const native = Platform.OS === 'android' ? nativeModule : null;

export function isAvailable(): boolean {
  return native != null;
}

export function setActiveConversation(convId: string | null): boolean {
  return native?.setActiveConversation?.(convId) ?? false;
}

export function setAppForeground(foreground: boolean): boolean {
  return native?.setAppForeground?.(foreground) ?? false;
}

export interface XmtpPushEvent {
  line?: string | null;
  convId?: string | null;
  messageId?: string | null;
}

export function subscribeXmtpPush(cb: (e: XmtpPushEvent) => void): () => void {
  const sub = native?.addListener?.('onXmtpPush', cb);
  return () => { try { sub?.remove?.(); } catch { } };
}
