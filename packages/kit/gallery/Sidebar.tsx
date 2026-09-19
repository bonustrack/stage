import { useMemo, useState } from 'react';
import { Box, Col, Row } from '../src/react-native/box';
import { Icon } from '../src/react-native/icon';
import { Input } from '../src/react-native/input';
import { Pressable } from '../src/react-native/pressable';
import { Text } from '../src/react-native/text';
import { useKitPalette } from '../src/react-native/theme-context';
import type { StoryEntry } from './story';
import { SCROLL_Y } from './styles';
import { useScheme } from './scheme';

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

function GroupRows({ group, activeId, onSelect }: { group: Group; activeId: string | null; onSelect: (id: string) => void }): React.ReactElement {
  const pal = useKitPalette();
  const open = group.stories.some((s) => s.id === activeId);
  const first = group.stories[0];
  const foldable = group.stories.length > 1;
  return (
    <Col>
      <Pressable onPress={() => { if (first) onSelect(first.id); }}>
        <Row align="center" gap={6} padding={{ x: 12, y: 6 }} radius="sm">
          {foldable ? <Icon name={open ? 'chevronDown' : 'chevronRight'} size={CHEVRON} color={pal.sub} /> : <Box width={CHEVRON} />}
          <Text size="lg" weight={open ? 'semibold' : 'normal'} color={open ? pal.link : pal.text}>{group.component}</Text>
        </Row>
      </Pressable>
      {open && foldable ? group.stories.map((story) => (
        <Pressable key={story.id} onPress={() => { onSelect(story.id); }}>
          <Row padding={{ left: 32, right: 12, y: 4 }}>
            <Text size="md" color={story.id === activeId ? pal.link : pal.sub}>{story.name}</Text>
          </Row>
        </Pressable>
      )) : null}
    </Col>
  );
}

export function Sidebar({ stories, activeId, onSelect }: { stories: StoryEntry[]; activeId: string | null; onSelect: (id: string) => void }): React.ReactElement {
  const { scheme, setScheme } = useScheme();
  const pal = useKitPalette();
  const dark = scheme === 'dark';
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => groupStories(stories, filter), [stories, filter]);
  return (
    <Col flex={1} gap={8}>
      <Row padding={{ x: 12, top: 12 }} align="center" gap={8}>
        <Box flex={1}>
          <Input dark={dark} size="md" placeholder="Search components" value={filter} onChangeText={setFilter} />
        </Box>
        <Pressable onPress={() => { setScheme(dark ? 'light' : 'dark'); }} accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <Box padding={8} radius="sm">
            <Icon name={dark ? 'sun' : 'moon'} size={20} color={pal.sub} />
          </Box>
        </Pressable>
      </Row>
      <Col flex={1} style={SCROLL_Y}>
        <Col padding={{ x: 4, bottom: 12 }}>
          {groups.map((group) => <GroupRows key={group.componentId} group={group} activeId={activeId} onSelect={onSelect} />)}
        </Col>
      </Col>
    </Col>
  );
}
