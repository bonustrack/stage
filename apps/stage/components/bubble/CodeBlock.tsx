import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { Box, Row } from '../layout';
import { HoverTooltip } from '../HoverTooltip';
import { highlightSegments } from '../HighlightText.model';
import { useHover } from '../hover';
import { capabilities } from '../../lib/capabilities';
import { reported } from '../../lib/errorPolicy';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { HIGHLIGHT_BG } from '../../lib/uiColors';
import { useCopiedFlag } from '../../lib/useCopiedFlag';
import { MONO_FONT } from './helpers';
import { TEXT_11PX } from '../smallText';

const CODE_PAD = 12;
const CODE_TEXT = { fontFamily: MONO_FONT, lineHeight: 20, flexShrink: 0 } as const;

function CopyCodeButton({ code }: { code: string }): React.ReactElement {
  const pal = usePalette();
  const [copied, markCopied] = useCopiedFlag();
  const { hovered, hoverProps } = useHover();
  const copy = (): void => {
    void Promise.resolve(capabilities.copyToClipboard(code)).then(markCopied, reported('code.copy'));
  };
  const color = hovered || copied ? pal.link : pal.text;
  return (
    <HoverTooltip label={copied ? 'Copied' : 'Copy code'}>
      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied' : 'Copy code'}
        hitSlop={8}
        {...hoverProps}
      >
        <Row align="center" gap={4} padding={{ x: 6, y: 4 }}>
          {copied ? <Text color={color} style={TEXT_11PX}>Copied</Text> : null}
          <Glyph icon={copied ? IconCheckmark1 : IconSquareBehindSquare1} size={16} color={color}/>
        </Row>
      </Pressable>
    </HoverTooltip>
  );
}

function CodeText({ code, fg, selectable, highlight }: {
  code: string; fg: string; selectable?: boolean; highlight?: string;
}): React.ReactElement {
  const scheme = useEffectiveColorScheme();
  const query = highlight?.trim() ?? '';
  return (
    <Text variant="mono" size="xs" color={fg} selectable={selectable} style={CODE_TEXT}>
      {query === '' ? code : highlightSegments(code, query).map((segment, index) => (
        segment.match ? (
          <Text key={`${index}-${segment.value}`} size="sm" style={{ backgroundColor: HIGHLIGHT_BG[scheme] }}>{segment.value}</Text>
        ) : segment.value
      ))}
    </Text>
  );
}

export function CodeBlock({ code, lang, fg, selectable, highlight }: {
  code: string; lang?: string; fg: string; selectable?: boolean; highlight?: string;
}): React.ReactElement {
  const pal = usePalette();
  const scrollGesture = useMemo(() => Gesture.Native().disallowInterruption(true), []);
  return (
    <Box
      surface="raised" radius="md"
      style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: pal.border, overflow: 'hidden' }}
    >
      <Row align="center" justify="between" padding={{ left: CODE_PAD, right: 4, top: 2 }}>
        <Text role="secondary" numberOfLines={1} style={TEXT_11PX}>{lang ?? ''}</Text>
        <CopyCodeButton code={code}/>
      </Row>
      <GestureDetector gesture={scrollGesture}>
        <Scroll horizontal contentContainerStyle={{ paddingHorizontal: CODE_PAD, paddingBottom: 10 }}>
          <CodeText code={code} fg={fg} selectable={selectable} highlight={highlight}/>
        </Scroll>
      </GestureDetector>
    </Box>
  );
}
