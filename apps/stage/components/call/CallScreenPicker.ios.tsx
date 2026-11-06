import { useEffect, useRef } from 'react';
import { findNodeHandle, NativeModules } from 'react-native';
import { ScreenCapturePickerView } from 'react-native-webrtc';
import type { ScreenPicker } from '../../lib/calls';
import { Column } from '../layout';

const pickerManager = NativeModules.ScreenCapturePickerViewManager as { show: (handle: number) => void } | undefined;

export function CallScreenPicker({ host }: { host: { current: ScreenPicker | null } }): React.ReactElement {
  const ref = useRef<React.ElementRef<typeof ScreenCapturePickerView> | null>(null);
  useEffect(() => {
    const picker: ScreenPicker = {
      show: () => {
        const handle = findNodeHandle(ref.current);
        if (handle === null || !pickerManager) throw new Error('Screen broadcast picker unavailable');
        pickerManager.show(handle);
      },
    };
    host.current = picker;
    return () => {
      if (host.current === picker) host.current = null;
    };
  }, [host]);
  return (
    <Column pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
      <ScreenCapturePickerView ref={ref} />
    </Column>
  );
}
