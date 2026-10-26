import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from '../src/react-native/text';
import { KitThemeProvider, type KitPalette } from '../src/react-native/theme-context';
import { fontFamily, kitPalette } from '../src/tokens';
import { ControlsPanel } from './Controls';
import { Home } from './Home';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { argToText, coerceArgs, parseHash, serializeRoute } from './route';
import { SchemeContext, type Scheme } from './scheme';
import type { ArgType, StoryEntry } from './story';
import { SCROLL_Y } from './styles';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';

const SIDEBAR_WIDTH = 240;
const CONTROLS_WIDTH = 300;
const SCHEME_KEY = 'stage-kit-gallery.scheme';
const MENU_BELOW = 768;
const STACK_BELOW = 1024;

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

function StoryStage({ story, args, scroll, compact }: { story: StoryEntry; args: Record<string, unknown>; scroll: boolean; compact: boolean }): React.ReactElement {
  const Render = story.render;
  return (
    <Column weight={scroll ? 1 : undefined} gap={16} padding={compact ? 16 : 24} style={scroll ? SCROLL_Y : undefined}>
      {compact ? null : (
        <Row align="baseline" gap={8}>
          <Text fontWeight="semibold" size="2xl">{story.component}</Text>
          <Text size="lg" color="secondary">{story.name}</Text>
        </Row>
      )}
      <Column><Render {...args} /></Column>
    </Column>
  );
}

export function App({ stories }: { stories: StoryEntry[] }): React.ReactElement {
  const [scheme, setSchemeState] = useState<Scheme>(readScheme);
  const setScheme = useCallback((next: Scheme) => {
    setSchemeState(next);
    try { localStorage.setItem(SCHEME_KEY, next); } catch { }
  }, []);
  const [route, navigate] = useHashRoute();
  const { width } = useWindowDimensions();
  const menu = width < MENU_BELOW;
  const stacked = width < STACK_BELOW;
  const [menuOpen, setMenuOpen] = useState(false);
  const story = route.storyId === null ? null : stories.find((s) => s.id === route.storyId) ?? stories[0] ?? null;
  const argTypes = useMemo(() => (story?.render.argTypes ?? {}) as Record<string, ArgType>, [story]);
  const defaults = useMemo(() => story?.render.args ?? {}, [story]);
  const args = useMemo(() => ({ ...defaults, ...coerceArgs(route.args, argTypes) }), [defaults, route.args, argTypes]);
  const palette = PALETTES[scheme];
  useEffect(() => { applyDocumentScheme(scheme, palette); }, [scheme, palette]);

  const setArg = (name: string, next: unknown): void => {
    if (!story) return;
    const keep = next !== undefined && next !== defaults[name];
    const nextArgs: Record<string, string> = {};
    for (const [key, value] of Object.entries(route.args)) if (key !== name) nextArgs[key] = value;
    if (keep) nextArgs[name] = argToText(next);
    navigate(serializeRoute(story.id, nextArgs));
  };

  const select = (id: string | null): void => {
    setMenuOpen(false);
    navigate(id === null ? '#/' : serializeRoute(id, {}));
    window.scrollTo(0, 0);
  };
  const activeId = story?.id ?? null;
  const stage = story
    ? <StoryStage key={story.id} story={story} args={args} scroll={!stacked} compact={menu} />
    : <Home stories={stories} onOpen={select} scroll={!stacked} compact={menu} />;
  const controls = story && Object.keys(argTypes).length > 0
    ? <ControlsPanel argTypes={argTypes} values={args} onChange={setArg} onReset={() => { navigate(serializeRoute(story.id, {})); }} touch={menu} />
    : null;
  const controlsBelow = controls ? <Column surface="toolbar" border={{ top: { width: 1, color: palette.border } }}>{controls}</Column> : null;

  return (
    <SchemeContext.Provider value={{ scheme, setScheme }}>
      <SafeAreaProvider>
        <KitThemeProvider value={palette} scheme={scheme}>
          {menu ? (
            <Column surface="surface" minHeight="100%">
              <TopBar story={story} open={menuOpen} onToggle={() => { setMenuOpen(!menuOpen); window.scrollTo(0, 0); }} />
              {menuOpen ? <Sidebar stories={stories} activeId={activeId} onSelect={select} touch /> : <>{stage}{controlsBelow}</>}
            </Column>
          ) : (
            <Row surface="surface" height="100vh">
              <Column width={SIDEBAR_WIDTH} surface="toolbar" border={{ right: { width: 1, color: palette.border } }}>
                <Sidebar stories={stories} activeId={activeId} onSelect={select} />
              </Column>
              {stacked ? <Column weight={1} style={SCROLL_Y}>{stage}{controlsBelow}</Column> : stage}
              {!stacked && controls ? (
                <Column width={CONTROLS_WIDTH} surface="toolbar" border={{ left: { width: 1, color: palette.border } }} style={SCROLL_Y}>{controls}</Column>
              ) : null}
            </Row>
          )}
        </KitThemeProvider>
      </SafeAreaProvider>
    </SchemeContext.Provider>
  );
}
