import { Glyph } from '../src/react-native/glyph';
import { Pressable } from '../src/react-native/pressable';
import { Text } from '../src/react-native/text';
import { useKitPalette } from '../src/react-native/theme-context';
import type { StoryEntry } from './story';
import { SchemeToggle } from './Sidebar';
import { STICKY_TOP } from './styles';
import { IconBarsTwo } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBarsTwo';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';

export function TopBar({ story, open, onToggle }: { story: StoryEntry | null; open: boolean; onToggle: () => void }): React.ReactElement {
  const pal = useKitPalette();
  return (
    <Row align="center" padding={{ x: 4 }} surface="toolbar" border={{ bottom: { width: 1, color: pal.border } }} style={STICKY_TOP}>
      <Column weight={1}>
        <Pressable onPress={onToggle} accessibilityLabel={open ? 'Close menu' : 'Open menu'}>
          <Row align="center" gap={10} padding={12}>
            <Glyph icon={open ? IconCrossMedium : IconBarsTwo} size={20} color={pal.text} />
            {story ? (
              <Row weight={1} align="baseline" gap={6}>
                <Text fontWeight="semibold" size="md" truncate>
                  {story.component}
                </Text>
                <Text size="xs" color="secondary" truncate style={{ flexShrink: 1 }}>
                  {story.name}
                </Text>
              </Row>
            ) : (
              <Text fontWeight="semibold" size="md" truncate>
                Home
              </Text>
            )}
          </Row>
        </Pressable>
      </Column>
      <SchemeToggle pad={12} />
    </Row>
  );
}
