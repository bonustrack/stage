import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { loadLastRoute, saveLastRoute } from '../lib/last-route';
import { loadConfig, isConfigured } from '../lib/config';
import { uploadAttachment } from '../lib/messenger';
import { pushStagedAttachments } from '../lib/share-intent-staging';
import { useShareIntent } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { attachReplyHandler } from '../lib/push';
import { ActivityIndicator, Text, TextInput, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

/** Set Calibre-Medium as the app-wide default for Text + TextInput via defaultProps.
 *  This is a fallback — call-site `style={{…}}` overrides — but it'​s the safest path:
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

  /** Tapping a messenger push notification deep-links into the messenger tab —
   *  unless the user used the inline Reply action, which `attachReplyHandler`
   *  handles separately (and shouldn'​t pull focus into the app). */
  useEffect(() => {
    attachReplyHandler();
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      if (resp.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        router.push('/(tabs)/messenger');
      }
    });
    return (): void => sub.remove();
  }, [router]);

  /** Restore the last tab on cold open. Run once on mount, before the user has
   *  a chance to navigate manually. The notification deep-link above can still
   *  override (later effect → later navigate). */
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

  /** Android Share Intent → messenger composer. Files arrive via expo-share-intent
   *  (intent filters configured in app.json). We upload each file to /api/messenger/upload,
   *  stage the resulting Attachment objects in a module-level queue, then push the
   *  user into the messenger tab. The composer drains the queue into its `pending`
   *  state so the attachments appear pre-staged. */
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;
    void (async (): Promise<void> => {
      const cfg = await loadConfig();
      if (!cfg || !isConfigured(cfg)) { resetShareIntent(); return; }
      const files = shareIntent.files ?? [];
      for (const f of files) {
        try {
          const att = await uploadAttachment(
            cfg.daemonUrl, cfg.token, f.path,
            f.mimeType ?? 'application/octet-stream',
            f.fileName ?? undefined,
          );
          pushStagedAttachments(att);
        } catch { /* ignore individual upload failures */ }
      }
      resetShareIntent();
      router.push('/(tabs)/messenger');
    })();
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons).
   *  TTF (not WOFF2) so Android'​s native Typeface loader can pick it up — expo-font's WOFF2
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
      </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
