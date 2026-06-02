/** Phase 0 video-call proof — a self-contained camera-preview test screen.
 *
 *  Goal: prove react-native-webrtc compiles into the dev APK and the LOCAL
 *  camera renders on-device. It calls `mediaDevices.getUserMedia({audio,video})`
 *  (which triggers the OS camera + mic permission prompts wired by the
 *  @config-plugins/react-native-webrtc plugin) and renders the resulting local
 *  MediaStream in an `RTCView`. Start/Stop toggles capture and releases tracks.
 *
 *  react-native-webrtc is resolved through lib/webrtc's lazy native guard, so
 *  this screen (and the whole bundle) stays clean on a binary without the
 *  native module — it just shows "WebRTC needs the dev build". */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { getWebRTC } from '../../lib/webrtc';
import type { MediaStream } from 'react-native-webrtc';

export function CallTestScreen(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, bg, border } = usePalette();
  const insets = useSafeAreaInsets();

  const webrtc = getWebRTC();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    if (!webrtc) return;
    setError(null);
    setBusy(true);
    try {
      const s = await webrtc.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = s;
      setStream(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'getUserMedia failed');
    } finally {
      setBusy(false);
    }
  }, [webrtc]);

  useEffect(() => () => stop(), [stop]);

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Call test" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom, gap: 16 }}>
        {!webrtc ? (
          <Text style={{ color: fg, fontSize: 16 }}>
            WebRTC needs the dev build. Install the feat/video-calls dev APK to test the camera.
          </Text>
        ) : (
          <>
            <Box
              style={{
                height: 360,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#000',
                borderWidth: 1,
                borderColor: border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {stream ? (
                <webrtc.RTCView
                  streamURL={stream.toURL()}
                  mirror
                  objectFit="cover"
                  style={{ flex: 1, alignSelf: 'stretch' }}
                />
              ) : (
                <Text style={{ color: '#888', fontSize: 15 }}>Camera off</Text>
              )}
            </Box>

            {error ? (
              <Text style={{ color: '#e5484d', fontSize: 14 }}>{error}</Text>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={stream ? stop : start}
              style={({ pressed }) => ({
                backgroundColor: stream ? '#e5484d' : '#3b82f6',
                opacity: pressed || busy ? 0.7 : 1,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'Calibre-Medium' }}>
                {busy ? 'Starting…' : stream ? 'Stop camera' : 'Start camera'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Box>
  );
}
