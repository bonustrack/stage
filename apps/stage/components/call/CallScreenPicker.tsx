import { useEffect, useRef } from 'react';
import { findNodeHandle, NativeModules, Platform } from 'react-native';
import { Box } from '../layout';
import { ScreenCapturePickerView } from 'react-native-webrtc';
import { registerScreenPicker } from '../../lib/calls.screen';

const pickerManager = NativeModules.ScreenCapturePickerViewManager as { show: (handle: number) => void } | undefined;

export function CallScreenPicker(): React.ReactElement | null {
  const ref = useRef<React.ElementRef<typeof ScreenCapturePickerView> | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    return registerScreenPicker(() => {
      const handle = findNodeHandle(ref.current);
      if (handle === null || !pickerManager) throw new Error('Screen broadcast picker unavailable');
      pickerManager.show(handle);
    });
  }, []);
  if (Platform.OS !== 'ios') return null;
  return <Box pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}><ScreenCapturePickerView ref={ref}/></Box>;
}
