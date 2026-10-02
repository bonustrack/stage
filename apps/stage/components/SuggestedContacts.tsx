import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Eyebrow } from './Eyebrow';
import { Box, PAGE_GUTTER } from './layout';
import { ChannelRow } from './ChannelRow';
import { getPeerDescription, usePeerProfiles } from '../lib/peerProfiles';
import { useActiveAccountRecord } from '../modules/messaging';
import { SUGGESTED_HEADING, suggestedContacts, suggestedSubtitle } from './SuggestedContacts.model';
import { peerLabel } from './conversation/convTitle';

export function SuggestedContacts({ known, headingTop = 16 }: { known: readonly string[]; headingTop?: number }): React.ReactElement | null {
  const router = useRouter();
  const self = useActiveAccountRecord()?.address ?? null;
  const addresses = useMemo(() => suggestedContacts(known, self), [known, self]);
  usePeerProfiles(addresses);
  if (addresses.length === 0) return null;
  return (
    <Box>
      <Box padding={{ x: PAGE_GUTTER, top: headingTop, bottom: 6 }}>
        <Eyebrow value={SUGGESTED_HEADING} color="secondary" weight="semibold"/>
      </Box>
      {addresses.map((address) => (
        <ChannelRow
          key={address}
          title={peerLabel(address)}
          avatarAddress={address}
          square={false}
          subtitle={suggestedSubtitle(getPeerDescription(address))}
          onPress={() => { router.push({ pathname: '/[convId]', params: { convId: address } }); }}
        />
      ))}
    </Box>
  );
}
