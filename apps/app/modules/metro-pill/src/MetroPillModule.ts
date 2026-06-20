import { NativeModule, requireNativeModule } from 'expo-modules-core';

interface XmtpPushEvent {
  line?: string | null;
  convId?: string | null;
  messageId?: string | null;
}

interface MetroPillEvents {
  [event: string]: (e: XmtpPushEvent) => void;
  onXmtpPush: (e: XmtpPushEvent) => void;
}

declare class MetroPillModule extends NativeModule<MetroPillEvents> {
  setActiveConversation(convId: string | null): boolean;
  setAppForeground(foreground: boolean): boolean;
}

let resolved: MetroPillModule | null = null;
try {
  resolved = requireNativeModule<MetroPillModule>('MetroPill');
} catch {
  resolved = null;
}

export default resolved;
