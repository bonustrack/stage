import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { loadLastRoute, saveLastRoute } from '../lib/last-route';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, Text, TextInput, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

/** Set Calibre-Medium as the app-wide default for Text + TextInput via defaultProps.
 *  This is a fallback — call-site `style={{…}}` overrides — but it's the safest path:
 *  monkey-patching the forwardRef render fn upstream broke FlatList.scrollToOffset on
 *  some Android versions (see git for details). Individual screens that want guaranteed
 *  Calibre should pin fontFamily explicitly. */
(function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps || {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps || {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
})();

export default function RootLayout(): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const router = useRouter();

  /** Restore the last tab on cold open. Run once on mount, before the user has
   *  a chance to navigate manually. */
  const restoredRoute = useRef(false);
  useEffect(() => {
    if (restoredRoute.current) return;
    restoredRoute.current = true;
    void loadLastRoute().then(p => {
      if (p && p !== '/' && p !== '/(tabs)') router.replace(p);
    });
  }, [router]);

  /** Persist on every route change. */
  const pathname = usePathname();
  useEffect(() => { void saveLastRoute(pathname); }, [pathname]);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons).
   *  TTF (not WOFF2) so Android's native Typeface loader can pick it up — expo-font's WOFF2
   *  support is web-only. */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf'),
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf'),
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#000000' : '#ffffff' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: dark ? '#000000' : '#ffffff' },
          headerTintColor: dark ? '#e8ecf2' : '#1a1f29',
          headerTitleStyle: { fontFamily: 'Calibre-Semibold' },
          contentStyle: { backgroundColor: dark ? '#000000' : '#ffffff' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="xmtp/[convId]" options={{ headerShown: false }} />
      </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
