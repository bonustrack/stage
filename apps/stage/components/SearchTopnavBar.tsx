
import { Fragment, forwardRef, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Input, SEARCH_INPUT_PROPS, type InputProps } from '@stage-labs/kit/react-native/input';
import { Box, Row, STICKY_UNDER_CHROME, PAGE_GUTTER } from './layout';
import { TOPNAV_HEIGHT } from './Topnav';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { FORM_FIELD_HEIGHT, FormField } from './FormField';
import { HoverTooltip } from './HoverTooltip';
import { HoverIconButton } from './hover';

const BAR_GAP = 10;
const FIELD_GAP = 4;
export const SEARCH_FIELD_HEIGHT = FORM_FIELD_HEIGHT + FIELD_GAP;

function StickyFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Box style={STICKY_UNDER_CHROME}>{children}</Box>;
}

function SearchMagnifier({ persistent, color, onOpen, focus }: {
  persistent?: boolean; color: string; onOpen?: () => void; focus: () => void;
}): React.ReactElement | null {
  return persistent === true ? <HoverIconButton icon={IconMagnifyingGlass} label="Search" role="button"
    color={color} placement="below" shortcut="/" onShortcut={onOpen} onPress={focus}/> : null;
}

function SearchActions({ persistent, query, clear, onClose, sub, trailing }: {
  persistent?: boolean; query: string; clear: () => void; onClose: () => void; sub: string; trailing?: React.ReactNode;
}): React.ReactElement {
  return <>
    {persistent !== true || query !== '' ? <Pressable
      onPress={persistent === true ? clear : onClose} hitSlop={8} accessibilityRole="button"
      accessibilityLabel={persistent === true ? 'Clear search' : 'Close search'}>
      <Glyph icon={IconCrossMedium} size={18} color={sub}/>
    </Pressable> : null}
    {trailing !== undefined ? <Row align="center" gap={18}>{trailing}</Row> : null}
  </>;
}

function useSearchFocus(head: string, sub: string, inputProps: InputProps['inputProps']): { color: string; handlers: InputProps['inputProps'] } {
  const [focused, setFocused] = useState(false);
  return {
    color: focused ? head : sub,
    handlers: {
      onFocus: event => { setFocused(true); inputProps?.onFocus?.(event); },
      onBlur: event => { setFocused(false); inputProps?.onBlur?.(event); },
    },
  };
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
  field?: boolean;
  persistent?: boolean;
  onOpen?: () => void;
  autoFocus?: boolean;
  trailing?: React.ReactNode;
  inputProps?: InputProps['inputProps'];
}>(function SearchTopnavBar(props, ref): React.ReactElement {
  const { head, sub } = props;
  const focus = useSearchFocus(head, sub, props.inputProps);
  const input = useRef<React.ComponentRef<typeof Input>>(null);
  const inputRef = (node: React.ComponentRef<typeof Input> | null): void => {
    input.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref !== null) ref.current = node;
  };
  const clear = (): void => { props.setQuery(''); input.current?.focus(); };
  const topInset = props.topInset ?? 0;
  const Frame = props.inline === true ? Fragment : StickyFrame;
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    SEARCH_INPUT_PROPS.onKeyPress?.(event);
    if (event.nativeEvent.key === 'Escape' && props.query === '') {
      if (props.field === true || props.persistent === true) input.current?.blur();
      props.onClose();
    } else props.inputProps?.onKeyPress?.(event);
  };
  const inputProps: InputProps['inputProps'] = {
    autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'search', ...props.inputProps, ...SEARCH_INPUT_PROPS, onKeyPress,
    ...focus.handlers,
  };
  if (props.field === true) {
    return (
      <Frame>
        <Row height={SEARCH_FIELD_HEIGHT} padding={{ x: PAGE_GUTTER, bottom: FIELD_GAP }} surface="toolbar" align="center">
          <Box flex={1}>
            <FormField
              inputRef={inputRef}
              autoFocus={props.autoFocus ?? false}
              value={props.query} onChangeText={props.setQuery} placeholder={props.placeholder ?? 'Search'}
              inputProps={{ accessibilityLabel: 'Search', ...inputProps }}
              leading={<HoverTooltip label="Search" placement="below" shortcut="/" onShortcut={props.onOpen}>
                <Glyph icon={IconMagnifyingGlass} size={20} color={focus.color}/>
              </HoverTooltip>}
              trailing={props.query === '' ? undefined : <Pressable
                onPress={clear}
                hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Glyph icon={IconCrossMedium} size={18} color={sub}/>
              </Pressable>}
            />
          </Box>
        </Row>
      </Frame>
    );
  }
  return (
    <Frame>
    <Row
      height={TOPNAV_HEIGHT + topInset}
      padding={{ x: PAGE_GUTTER, top: topInset }}
      align="center" gap={BAR_GAP} surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: props.border }}>
      <SearchMagnifier persistent={props.persistent} color={focus.color} onOpen={props.onOpen} focus={() => { input.current?.focus(); }}/>
      <Input
        ref={inputRef}
        autoFocus={props.autoFocus ?? true}
        value={props.query}
        onChangeText={props.setQuery}
        placeholder={props.placeholder ?? 'Search'}
        placeholderTextColor={sub}
        inputProps={inputProps}
        style={{ flex: 1, minWidth: 0, color: head, fontSize: fontSize('lg'), lineHeight: 23, fontFamily: 'Calibre-Medium', padding: 0,
          backgroundColor: 'transparent', minHeight: 0, borderWidth: 0, paddingLeft: props.persistent === true ? 0 : undefined }}
/>
      <SearchActions {...props} clear={clear}/>
    </Row>
    </Frame>
  );
});
