import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, Text, TextInput, useColorScheme, View } from 'react-native';

/** Set Calibre-Medium as the app-wide default for Text + TextInput (RN has no global font setting). */
function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps || {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps || {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
}

export default function RootLayout(): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons). */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.woff2'),
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.woff2'),
  });

  if (loaded) applyDefaultFont();

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0f1115' : '#ffffff' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: dark ? '#0f1115' : '#ffffff' },
          headerTintColor: dark ? '#e8ecf2' : '#1a1f29',
          headerTitleStyle: { fontFamily: 'Calibre-Semibold' },
          contentStyle: { backgroundColor: dark ? '#0f1115' : '#ffffff' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
      </Stack>
    </>
  );
}
