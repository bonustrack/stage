import { NativeModule, requireNativeModule } from 'expo-modules-core';

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

let resolved: StagePillModule | null = null;
try {
  resolved = requireNativeModule<StagePillModule>('StagePill');
} catch {
  resolved = null;
}

export default resolved;
