
import { Fragment, forwardRef } from 'react';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Input, type InputProps } from '@stage-labs/kit/react-native/input';
import { Box, Row, STICKY_UNDER_CHROME, PAGE_GUTTER } from './layout';
import { TOPNAV_HEIGHT } from './Topnav';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';

const BAR_GAP = 10;

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
  autoFocus?: boolean;
  trailing?: React.ReactNode;
  inputProps?: InputProps['inputProps'];
}>(function SearchTopnavBar(props, ref): React.ReactElement {
  const { head, sub } = props;
  const topInset = props.topInset ?? 0;
  const Frame = props.inline === true ? Fragment : StickyFrame;
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (event.nativeEvent.key === 'Escape' && props.query === '') props.onClose();
    else props.inputProps?.onKeyPress?.(event);
  };
  return (
    <Frame>
    <Row
      height={TOPNAV_HEIGHT + topInset}
      padding={{ x: PAGE_GUTTER, top: topInset }}
      align="center" gap={BAR_GAP} surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: props.border }}>
      <Input
        ref={ref}
        autoFocus={props.autoFocus ?? true}
        value={props.query}
        onChangeText={props.setQuery}
        placeholder={props.placeholder ?? 'Search'}
        placeholderTextColor={sub}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'search', ...props.inputProps, onKeyPress }}
        style={{ flex: 1, minWidth: 0, color: head, fontSize: fontSize('3xl'), lineHeight: 23, fontFamily: 'Calibre-Medium', padding: 0,
          backgroundColor: 'transparent', minHeight: 0, borderWidth: 0 }}
/>
      <Pressable onPress={props.onClose} hitSlop={8} accessibilityLabel="Close search">
        <Glyph icon={IconCrossMedium} size={18} color={sub}/>
      </Pressable>
      {props.trailing !== undefined ? <Row align="center" gap={18}>{props.trailing}</Row> : null}
    </Row>
    </Frame>
  );
});
