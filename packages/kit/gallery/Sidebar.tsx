import { useMemo, useState } from 'react';
import { Box, Col, Row } from '../src/react-native/box';
import { Glyph } from '../src/react-native/glyph';
import { Input, SEARCH_INPUT_PROPS } from '../src/react-native/input';
import { Pressable } from '../src/react-native/pressable';
import { Text } from '../src/react-native/text';
import { useKitPalette } from '../src/react-native/theme-context';
import type { StoryEntry } from './story';
import { SCROLL_Y } from './styles';
import { useScheme } from './scheme';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';
import { IconMoon } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMoon';
import { IconSun } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSun';

const CHEVRON = 14;

interface Group { componentId: string; component: string; stories: StoryEntry[] }

function groupStories(stories: StoryEntry[], filter: string): Group[] {
  const needle = filter.trim().toLowerCase();
  const groups = new Map<string, Group>();
  for (const story of stories) {
    if (needle && !story.component.toLowerCase().includes(needle) && !story.name.toLowerCase().includes(needle)) continue;
    const group = groups.get(story.componentId) ?? { componentId: story.componentId, component: story.component, stories: [] };
    group.stories.push(story);
    groups.set(story.componentId, group);
  }
  return [...groups.values()];
}

export function SchemeToggle({ pad }: { pad: number }): React.ReactElement {
  const { scheme, setScheme } = useScheme();
  const pal = useKitPalette();
  const dark = scheme === 'dark';
  return (
    <Pressable onPress={() => { setScheme(dark ? 'light' : 'dark'); }} accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Box padding={pad} radius="sm">
        <Glyph icon={dark ? IconSun : IconMoon} size={20} color={pal.sub} />
      </Box>
    </Pressable>
  );
}

function GroupRows({ group, activeId, onSelect, touch }: { group: Group; activeId: string | null; onSelect: (id: string) => void; touch: boolean }): React.ReactElement {
  const pal = useKitPalette();
  const open = group.stories.some((s) => s.id === activeId);
  const first = group.stories[0];
  const foldable = group.stories.length > 1;
  return (
    <Col>
      <Pressable onPress={() => { if (first) onSelect(first.id); }}>
        <Row align="center" gap={6} padding={{ x: 12, y: touch ? 13 : 6 }} radius="sm">
          {foldable ? <Glyph icon={open ? IconChevronBottom : IconChevronRight} size={CHEVRON} color={pal.sub} /> : <Box width={CHEVRON} />}
          <Text size="xs" weight={open ? 'semibold' : 'normal'} color={open ? pal.link : pal.text}>{group.component}</Text>
        </Row>
      </Pressable>
      {open && foldable ? group.stories.map((story) => (
        <Pressable key={story.id} onPress={() => { onSelect(story.id); }}>
          <Row padding={{ left: 32, right: 12, y: touch ? 13 : 4 }}>
            <Text size="2xs" color={story.id === activeId ? pal.link : pal.sub}>{story.name}</Text>
          </Row>
        </Pressable>
      )) : null}
    </Col>
  );
}

export function Sidebar({ stories, activeId, onSelect, touch = false }: { stories: StoryEntry[]; activeId: string | null; onSelect: (id: string) => void; touch?: boolean }): React.ReactElement {
  const dark = useScheme().scheme === 'dark';
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => groupStories(stories, filter), [stories, filter]);
  return (
    <Col flex={1} gap={8}>
      <Row padding={{ x: 12, top: 12 }} align="center" gap={8}>
        <Box flex={1}>
          <Input dark={dark} size={touch ? 'lg' : 'md'} placeholder="Search components" value={filter} onChangeText={setFilter} inputProps={SEARCH_INPUT_PROPS} />
        </Box>
        {touch ? null : <SchemeToggle pad={8} />}
      </Row>
      <Col flex={1} style={SCROLL_Y}>
        <Col padding={{ x: 4, bottom: 12 }}>
          {groups.map((group) => <GroupRows key={group.componentId} group={group} activeId={activeId} onSelect={onSelect} touch={touch} />)}
        </Col>
      </Col>
    </Col>
  );
}
