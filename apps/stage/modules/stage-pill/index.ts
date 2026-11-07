import { NativeModule, requireOptionalNativeModule } from 'expo';
import { attempt } from '../../lib/errorPolicy';

interface XmtpPushEvent {
  topic?: string | null;
  convId?: string | null;
  messageId?: string | null;
}

interface StagePillEvents {
  [event: string]: (e: XmtpPushEvent) => void;
  onXmtpPush: (e: XmtpPushEvent) => void;
}

declare class StagePillModule extends NativeModule<StagePillEvents> {
  setActiveConversation(convId: string | null): boolean;
  setAppForeground(foreground: boolean): boolean;
}

const native = requireOptionalNativeModule<StagePillModule>('StagePill');

export function setActiveConversation(convId: string | null): boolean {
  return native?.setActiveConversation?.(convId) ?? false;
}

export function setAppForeground(foreground: boolean): boolean {
  return native?.setAppForeground?.(foreground) ?? false;
}

export function subscribeXmtpPush(cb: (e: XmtpPushEvent) => void): () => void {
  const sub = native?.addListener?.('onXmtpPush', cb);
  return () => {
    attempt(() => {
      sub?.remove?.();
    }, 'cleanup');
  };
}
