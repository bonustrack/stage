import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { ActivityIndicator, Text, TextInput, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

/** Set Calibre-Medium as the app-wide default for Text + TextInput (RN has no global font setting). */
/** Also makes every Text selectable so users can copy any rendered string (incl. markdown bodies). */
function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps || {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps || {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
}

export default function RootLayout(): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const router = useRouter();

  /** Tapping a messenger push notification deep-links into the messenger tab. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/messenger');
    });
    return (): void => sub.remove();
  }, [router]);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons). */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.woff2'),
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.woff2'),
  });

  if (loaded) applyDefaultFont();

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
