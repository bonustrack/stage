import { Fragment, forwardRef } from 'react';
import { fontName, fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { TextField, type TextFieldProps } from '@stage-labs/kit/react-native/text-field';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { TOPNAV_HEIGHT } from '../Topnav';
import { HoverIconButton } from '../hover';
import { usePalette } from '../../lib/theme';
import { useSearchInput } from './searchInput';
import { Column, Row, STICKY_UNDER_CHROME, PAGE_GUTTER } from '../layout';

const BAR_GAP = 10;

function StickyFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Column style={STICKY_UNDER_CHROME}>{children}</Column>;
}

function SearchActions({
  persistent,
  query,
  clear,
  onClose,
  color,
  trailing,
}: {
  persistent: boolean;
  query: string;
  clear: () => void;
  onClose: () => void;
  color: string;
  trailing?: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      {!persistent || query !== '' ? (
        <Pressable
          onPress={persistent ? clear : onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={persistent ? 'Clear search' : 'Close search'}
        >
          <Glyph icon={IconCrossMedium} size={18} color={color} />
        </Pressable>
      ) : null}
      {trailing !== undefined ? (
        <Row align="center" gap={18}>
          {trailing}
        </Row>
      ) : null}
    </>
  );
}

export interface TopnavSearchProps {
  query: string;
  setQuery: (query: string) => void;
  onClose: () => void;
  placeholder?: string;
  topInset?: number;
  inline?: boolean;
  persistent?: boolean;
  onOpen?: () => void;
  autoFocus?: boolean;
  trailing?: React.ReactNode;
  inputProps?: TextFieldProps['inputProps'];
}

export const TopnavSearch = forwardRef<React.ComponentRef<typeof TextField>, TopnavSearchProps>(function TopnavSearch(props, ref) {
  const { link, text, border } = usePalette();
  const persistent = props.persistent === true;
  const search = useSearchInput({ ...props, blurOnEscape: persistent, focusColor: link, restColor: text }, ref);
  const topInset = props.topInset ?? 0;
  const Frame = props.inline === true ? Fragment : StickyFrame;
  return (
    <Frame>
      <Row
        height={TOPNAV_HEIGHT + topInset}
        padding={{ x: PAGE_GUTTER, top: topInset }}
        align="center"
        gap={BAR_GAP}
        surface="toolbar"
        style={{ borderBottomWidth: 1, borderBottomColor: border }}
      >
        {persistent ? (
          <HoverIconButton
            icon={IconMagnifyingGlass}
            label="Search"
            role="button"
            color={search.color}
            placement="below"
            shortcut="/"
            onShortcut={props.onOpen}
            onPress={() => {
              search.input.current?.focus();
            }}
          />
        ) : null}
        <TextField
          ref={search.inputRef}
          autoFocus={props.autoFocus ?? true}
          value={props.query}
          onChangeText={props.setQuery}
          placeholder={props.placeholder ?? 'Search'}
          placeholderTextColor={text}
          inputProps={search.inputProps}
          style={{
            flex: 1,
            minWidth: 0,
            color: link,
            fontSize: fontSize('lg'),
            lineHeight: 23,
            fontFamily: fontName.sans,
            padding: 0,
            backgroundColor: 'transparent',
            minHeight: 0,
            borderWidth: 0,
            paddingLeft: persistent ? 0 : undefined,
          }}
        />
        <SearchActions
          persistent={persistent}
          query={props.query}
          clear={search.clear}
          onClose={props.onClose}
          color={text}
          trailing={props.trailing}
        />
      </Row>
    </Frame>
  );
});
