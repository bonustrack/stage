import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Eyebrow } from './Eyebrow';
import { ChannelRow } from './ChannelRow';
import { getPeerDescription, usePeerProfiles, peerLabel } from '../lib/peerProfiles';
import { useActiveAccountRecord } from '../modules/messaging/account';
import { SUGGESTED_HEADING, suggestedContacts, suggestedSubtitle } from './SuggestedContacts.model';
import { Column, PAGE_GUTTER } from './layout';

export function SuggestedContacts({ known, headingTop = 16 }: { known: readonly string[]; headingTop?: number }): React.ReactElement | null {
  const router = useRouter();
  const self = useActiveAccountRecord()?.address ?? null;
  const addresses = useMemo(() => suggestedContacts(known, self), [known, self]);
  usePeerProfiles(addresses);
  if (addresses.length === 0) return null;
  return (
    <Column>
      <Column padding={{ x: PAGE_GUTTER, top: headingTop, bottom: 6 }}>
        <Eyebrow text={SUGGESTED_HEADING} color="secondary" fontWeight="semibold"/>
      </Column>
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
    </Column>
  );
}
