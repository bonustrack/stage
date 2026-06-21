import '../lib/jsPolyfills';
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { TextInput } from '../components/layout/native';
import { Col } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { Onboarding } from '../components/onboarding/Onboarding';
import { useAccountGate } from '../lib/accountGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { TransitionPresets, TransitionSpecs } from '@react-navigation/stack';
import { NativeSwipeStack } from '../components/NativeSwipeStack';
import { useEffectiveColorScheme, usePalette, useRadius } from '../lib/theme';
import { KitThemeProvider } from '@stage-labs/kit/react-native/theme-context';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreGate } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/push';
import { ensureActiveAccount, ensureMessagingStreamSync } from '../modules/messaging';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';

const queryClient = getQueryClient();

(function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
})();

function isDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const hexDigits = m?.[1];
  if (hexDigits === undefined) return true;
  const n = parseInt(hexDigits, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

export default function RootLayout(): React.ReactElement {
  const scheme = useEffectiveColorScheme();
  const palette = usePalette();
  return (
    <KitThemeProvider value={palette} scheme={scheme}>
      <RootLayoutInner />
    </KitThemeProvider>
  );
}

function RootLayoutInner(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, toolbarBg } = usePalette();
  useRadius();

  const barStyle: 'light' | 'dark' = isDarkBg(toolbarBg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  useDeepLinks();

  const restore = useRestoreGate();

  usePushDeepLinks();

  const onboarding = useAccountGate();

  useEffect(() => { if (onboarding.hasAccount) void ensureActiveAccount(); }, [onboarding.hasAccount]);
  useEffect(() => { ensureMessagingStreamSync(); }, []);

  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf') as number,
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf') as number,
  });

  const gatesOpen = loaded && onboarding.ready && restore.ready;

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent"/>
      {}
      <NativeSwipeStack
        detachInactiveScreens
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          cardStyle: { backgroundColor: bg },
          gestureEnabled: true,
          gestureResponseDistance: 9999,
          ...TransitionPresets.SlideFromRightIOS,
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 0 } },
            close: TransitionSpecs.TransitionIOSSpec,
          },
        }}
>
        {}
        <NativeSwipeStack.Screen
          name="(tabs)"
          options={{ animationEnabled: false, gestureEnabled: false }}
/>
      </NativeSwipeStack>
      {}
      {!gatesOpen ? (
        <Col
          surface="surface" align="center" justify="center"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
>
          <Spinner size={28} color={dark ? '#ffffff' : '#000000'}/>
        </Col>
      ) : !onboarding.hasAccount ? (
        <Col
          surface="surface"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
>
          {}
          <Onboarding onDone={() => undefined} />
        </Col>
      ) : null}
      </KeyboardProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
