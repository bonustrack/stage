
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { MODAL } from '@stage-labs/kit/react-native/modal';
import { ON_PRIMARY_COLOR } from '../../lib/uiColors';
import { usePalette } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';
import type { Contact } from '../../lib/useContacts';
import { Box, Row } from '../layout';
import { ChannelRow } from '../ChannelRow';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';

function SuggestionCheck({ selected, checkBackground, dark }: {
  selected: boolean; checkBackground: string; dark: boolean;
}): React.ReactElement {
  if (selected) {
    return (
      <Row width={24} height={24} radius="lg" background={checkBackground} align="center" justify="center">
        <Glyph
          icon={IconCheckmark1}
          size={14}
          color={dark ? ON_PRIMARY_COLOR.dark : ON_PRIMARY_COLOR.light}
          dark={dark}
        />
      </Row>
    );
  }
  const side = { width: 2, color: checkBackground };
  return (
    <Row
      width={24}
      height={24}
      radius="lg"
      align="center"
      justify="center"
      border={{ top: side, right: side, bottom: side, left: side }}
    />
  );
}

export function ContactSuggestions({
  contacts, selected, onToggle,
}: {
  contacts: Contact[];
  selected: Set<string>;
  onToggle: (contact: Contact) => void;
}): React.ReactElement | null {
  const { link: head } = usePalette();
  const dark = useKitScheme() === 'dark';
  if (contacts.length === 0) return null;
  return (
    <Box margin={{ x: -MODAL.padding }}>
      {contacts.map((c) => {
        const short = shortAddress(c.address);
        return (
          <ChannelRow
            key={c.address}
            title={c.name}
            avatarAddress={c.address}
            square={false}
            subtitle={c.name !== short ? short : null}
            onPress={() => { onToggle(c); }}
            accessory={<SuggestionCheck selected={selected.has(c.address.toLowerCase())} checkBackground={head} dark={dark} />}
          />
        );
      })}
    </Box>
  );
}
