
import { Fragment, forwardRef } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Input } from '@stage-labs/kit/react-native/input';
import { Box, Row, STICKY_UNDER_CHROME, PAGE_GUTTER } from './layout';
import { TOPNAV_HEIGHT } from './Topnav';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';

function StickyFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Box style={STICKY_UNDER_CHROME}>{children}</Box>;
}

export const SearchTopnavBar = forwardRef<React.ComponentRef<typeof Input>, {
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  head: string;
  sub: string;
  border: string;
  placeholder?: string;
  topInset?: number;
  inline?: boolean;
}>(function SearchTopnavBar(props, ref): React.ReactElement {
  const { head, sub } = props;
  const topInset = props.topInset ?? 0;
  const Frame = props.inline === true ? Fragment : StickyFrame;
  return (
    <Frame>
    <Row
      height={TOPNAV_HEIGHT + topInset}
      padding={{ x: PAGE_GUTTER, top: topInset }}
      align="center" gap={10} surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: props.border }}>
      <Pressable onPress={props.onClose} hitSlop={8}>
        <Glyph icon={IconArrowLeft} size={24} color={head}/>
      </Pressable>
      <Input
        ref={ref}
        autoFocus
        value={props.query}
        onChangeText={props.setQuery}
        placeholder={props.placeholder ?? 'Search'}
        placeholderTextColor={sub}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'search' }}
        style={{ flex: 1, color: head, fontSize: fontSize('4xl'), lineHeight: 23, fontFamily: 'Calibre-Medium', padding: 0,
          backgroundColor: 'transparent', minHeight: 0, borderWidth: 0 }}
/>
      {props.query.length> 0 ? (
        <Pressable onPress={() => { props.setQuery(''); }} hitSlop={8}>
          <Glyph icon={IconCrossMedium} size={18} color={sub}/>
        </Pressable>
      ) : null}
    </Row>
    </Frame>
  );
});
