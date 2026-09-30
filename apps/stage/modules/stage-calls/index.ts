import { NativeModule, requireNativeModule } from 'expo';

interface StageCallsEvents {
  [event: string]: (event: { started: boolean }) => void;
  onScreenShare: (event: { started: boolean }) => void;
}

declare class StageCallsModule extends NativeModule<StageCallsEvents> {
  start(video: boolean): Promise<void>;
  stop(): Promise<void>;
}

export const nativeCalls = requireNativeModule<StageCallsModule>('StageCalls');
