import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { KitThemeProvider, type KitPalette } from '../src/react-native/theme-context';
import { fontFamily, kitPalette } from '../src/tokens';
import { ControlsPanel } from './Controls';
import { Sidebar } from './Sidebar';
import { argToText, coerceArgs, parseHash, serializeRoute, type ArgValue } from './route';
import { SchemeContext, type Scheme } from './scheme';
import type { ArgType, StoryEntry } from './story';
import { SCROLL_Y } from './styles';

const SIDEBAR_WIDTH = 240;
const CONTROLS_WIDTH = 300;
const SCHEME_KEY = 'stage-kit-gallery.scheme';

const PALETTES: Record<Scheme, KitPalette> = { light: kitPalette('light'), dark: kitPalette('dark') };

function applyDocumentScheme(scheme: Scheme, palette: KitPalette): void {
  document.documentElement.style.colorScheme = scheme;
  document.body.style.backgroundColor = palette.bg;
  document.body.style.color = palette.text;
  document.body.style.fontFamily = fontFamily.sans.join(', ');
}

function readScheme(): Scheme {
  try { return localStorage.getItem(SCHEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

function useHashRoute(): [ReturnType<typeof parseHash>, (hash: string) => void] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = (): void => { setRoute(parseHash(window.location.hash)); };
    window.addEventListener('hashchange', onChange);
    return (): void => { window.removeEventListener('hashchange', onChange); };
  }, []);
  const navigate = useCallback((hash: string) => { if (window.location.hash !== hash) window.location.hash = hash; }, []);
  return [route, navigate];
}

function StoryStage({ story, args }: { story: StoryEntry; args: Record<string, unknown> }): React.ReactElement {
  const Render = story.render;
  return (
    <Col flex={1} gap={16} padding={24} style={SCROLL_Y}>
      <Row align="baseline" gap={8}>
        <Text weight="semibold" size="5xl">{story.component}</Text>
        <Text size="3xl" role="secondary">{story.name}</Text>
      </Row>
      <Box><Render {...args} /></Box>
    </Col>
  );
}

export function App({ stories }: { stories: StoryEntry[] }): React.ReactElement {
  const [scheme, setSchemeState] = useState<Scheme>(readScheme);
  const setScheme = useCallback((next: Scheme) => {
    setSchemeState(next);
    try { localStorage.setItem(SCHEME_KEY, next); } catch { }
  }, []);
  const [route, navigate] = useHashRoute();
  const story = stories.find((s) => s.id === route.storyId) ?? stories[0] ?? null;
  const argTypes = useMemo(() => (story?.render.argTypes ?? {}) as Record<string, ArgType>, [story]);
  const defaults = useMemo(() => story?.render.args ?? {}, [story]);
  const args = useMemo(() => ({ ...defaults, ...coerceArgs(route.args, argTypes) }), [defaults, route.args, argTypes]);
  const palette = PALETTES[scheme];
  useEffect(() => { applyDocumentScheme(scheme, palette); }, [scheme, palette]);

  const setArg = (name: string, next: unknown): void => {
    if (!story) return;
    const keep = next !== undefined && next !== defaults[name];
    const nextArgs: Record<string, ArgValue> = {};
    for (const [key, value] of Object.entries(route.args)) if (key !== name) nextArgs[key] = value;
    if (keep) nextArgs[name] = argToText(next);
    navigate(serializeRoute(story.id, nextArgs));
  };

  return (
    <SchemeContext.Provider value={{ scheme, setScheme }}>
      <SafeAreaProvider>
        <KitThemeProvider value={palette} scheme={scheme}>
          <Row surface="surface" height="100vh">
            <Col width={SIDEBAR_WIDTH} surface="toolbar" border={{ right: { width: 1, color: palette.border } }}>
              <Sidebar stories={stories} activeId={story?.id ?? null} onSelect={(id) => { navigate(serializeRoute(id, {})); }} />
            </Col>
            {story ? <StoryStage key={story.id} story={story} args={args} /> : <Text>No stories found</Text>}
            {story && Object.keys(argTypes).length > 0 ? (
              <Col width={CONTROLS_WIDTH} surface="toolbar" border={{ left: { width: 1, color: palette.border } }} style={SCROLL_Y}>
                <ControlsPanel argTypes={argTypes} values={args} onChange={setArg} onReset={() => { navigate(serializeRoute(story.id, {})); }} />
              </Col>
            ) : null}
          </Row>
        </KitThemeProvider>
      </SafeAreaProvider>
    </SchemeContext.Provider>
  );
}
