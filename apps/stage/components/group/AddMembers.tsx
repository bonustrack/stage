import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { Button } from '@stage-labs/kit/react-native/button';
import { addGroupMembers, invalidateConvMeta, useConvMeta } from '../../modules/messaging';
import { capabilities } from '../../lib/capabilities';
import { closeAddMembers, useAddMembersConv } from '../../lib/addMembersHost';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AppModal } from '../AppModal';
import { Col } from '../layout';
import { MemberPicker, useMemberPicker } from './MemberPicker';

export function AddMembersForm({ convId, onDone }: { convId: string; onDone: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { primary, bg } = usePalette();
  const picker = useMemberPicker();
  const { members } = picker;
  const { memberAddrs } = useConvMeta(convId);
  const [submitting, setSubmitting] = useState(false);
  const count = members.length;

  const submit = async (): Promise<void> => {
    if (count === 0 || submitting) return;
    setSubmitting(true);
    try {
      await addGroupMembers(convId, members.map(m => m.address));
      invalidateConvMeta(convId);
      onDone();
      capabilities.toast(count === 1 ? 'Member added' : `${count} members added`);
    } catch (err) {
      capabilities.toast((err as Error)?.message ?? "Couldn't add members");
      setSubmitting(false);
    }
  };

  return (
    <Col gap={16}>
      <MemberPicker state={picker} dark={dark} exclude={memberAddrs}/>
      <Button size="lg" fullWidth pill dark={dark} loading={submitting} disabled={count === 0}
        tintBg={primary} tintFg={bg} label={count > 0 ? `Add to group (${count})` : 'Add to group'}
        onPress={() => { void submit(); }}/>
    </Col>
  );
}

export function AddMembersHost(): React.ReactElement {
  const convId = useAddMembersConv();
  const pathname = usePathname();
  useEffect(() => { closeAddMembers(); }, [pathname]);
  return (
    <AppModal visible={convId !== null} onClose={closeAddMembers} title="Add members">
      {convId === null ? null : <AddMembersForm key={convId} convId={convId} onDone={closeAddMembers}/>}
    </AppModal>
  );
}
