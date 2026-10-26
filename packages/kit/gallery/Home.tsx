import { Component, type ReactNode } from 'react';
import { IconArrowRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRight';
import { Glyph } from '../src/react-native/glyph';
import { Pressable } from '../src/react-native/pressable';
import { Text } from '../src/react-native/text';
import { useKitPalette } from '../src/react-native/theme-context';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import type { StoryEntry } from './story';
import { SCROLL_Y } from './styles';

const CARD_WIDTH = 320;
const PREVIEW_HEIGHT = 220;
const CLIP = { overflow: 'hidden' } as const;

function homeExamples(stories: StoryEntry[]): StoryEntry[] {
  const byComponent = new Map<string, StoryEntry>();
  for (const story of stories) {
    const known = byComponent.get(story.componentId);
    if (known === undefined || (story.name === 'Controls' && known.name !== 'Controls')) byComponent.set(story.componentId, story);
  }
  return [...byComponent.values()];
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? <Text variant="caption" size="xs" text="This example could not be shown." /> : this.props.children;
  }
}

function ExampleCard({ story, onOpen, compact }: { story: StoryEntry; onOpen: (id: string) => void; compact: boolean }): React.ReactElement {
  const pal = useKitPalette();
  const Render = story.render;
  const side = { width: 1, color: pal.border };
  return (
    <Column width={compact ? '100%' : CARD_WIDTH} radius="lg" border={{ top: side, right: side, bottom: side, left: side }} style={CLIP}>
      <Pressable onPress={() => { onOpen(story.id); }} accessibilityRole="link" accessibilityLabel={`Open ${story.component}`}>
        <Row align="center" justify="spaceBetween" padding={{ x: 16, y: 12 }} surface="toolbar" border={{ bottom: side }}>
          <Text size="sm" fontWeight="semibold" text={story.component} />
          <Glyph icon={IconArrowRight} size={16} color={pal.sub} />
        </Row>
      </Pressable>
      <Column height={PREVIEW_HEIGHT} padding={16} style={CLIP}>
        <Column margin={{ y: 'auto' }}>
          <PreviewBoundary>
            <Render {...(story.render.args ?? {})} />
          </PreviewBoundary>
        </Column>
      </Column>
    </Column>
  );
}

export function Home({ stories, onOpen, scroll, compact }: {
  stories: StoryEntry[]; onOpen: (id: string) => void; scroll: boolean; compact: boolean;
}): React.ReactElement {
  const examples = homeExamples(stories);
  return (
    <Column weight={scroll ? 1 : undefined} gap={24} padding={compact ? 16 : 24} style={scroll ? SCROLL_Y : undefined}>
      <Column gap={6}>
        <Text fontWeight="semibold" size="2xl" text="Stage Kit" />
        <Text size="md" color="secondary" text={`One example of each of the ${examples.length} components. Open one to see all its stories and controls.`} />
      </Column>
      <Row gap={16} wrap>
        {examples.map((story) => <ExampleCard key={story.componentId} story={story} onOpen={onOpen} compact={compact} />)}
      </Row>
    </Column>
  );
}
