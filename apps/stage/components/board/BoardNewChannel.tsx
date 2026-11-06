import { useEffect, useRef, useState } from 'react';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { errorMessage } from '@stage-labs/client/errors';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { FormField, useFocusOnOpen } from '../FormField';
import { HoverIconButton } from '../hover';
import { Column, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { createGroup } from '../../lib/xmtp.groups';
import { schedulePushTopicRefresh } from '../../lib/pushRegister';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { rememberOwnGroup } from '../../modules/messaging/useConvConsent';
import { boardChannelDraft, boardChannelNameProblem } from './BoardNewChannel.model';
import { COLUMN_PADDING } from './BoardColumnEdit';

export function NewChannelButton({ title, onPress }: { title: string; onPress: () => void }): React.ReactElement {
  const { sub } = usePalette();
  return (
    <HoverIconButton
      icon={IconPlusLarge}
      size={16}
      color={sub}
      role="button"
      label={`New chat in ${title}`}
      placement="below"
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    />
  );
}

export function BoardNewChannel({
  by,
  columnKey,
  title,
  onClose,
}: {
  by: GroupKey;
  columnKey: string;
  title: string;
  onClose: () => void;
}): React.ReactElement {
  const account = useActiveAccountRecord();
  const { text } = usePalette();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const input = useFocusOnOpen();
  useEffect(() => {
    if (!creating) input.current?.focus();
  }, [creating]);
  const problem = boardChannelNameProblem(name);
  const close = (): void => {
    if (!busy.current) onClose();
  };
  const submit = async (): Promise<void> => {
    if (busy.current || account === null || problem !== null) return;
    busy.current = true;
    setCreating(true);
    setError(null);
    const draft = boardChannelDraft(by, columnKey, title, name, account.address);
    schedulePushTopicRefresh(10_000);
    try {
      const created = await createGroup(draft.members, draft.appData, draft.name);
      rememberOwnGroup(created.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      busy.current = false;
      setCreating(false);
    }
  };
  return (
    <Column padding={{ right: COLUMN_PADDING }}>
      <Column surface="surface" radius={BLOCK_RADIUS_DEFAULT} padding={8} gap={8}>
        <FormField
          label="Channel name"
          placeholder="Enter a channel name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          inputRef={input}
          disabled={creating}
          hint={error ?? (name.trim() === '' ? undefined : (problem ?? undefined))}
          hintTone="danger"
          onSubmit={() => {
            void submit();
          }}
          inputProps={{
            accessibilityLabel: 'Channel name',
            blurOnSubmit: false,
            returnKeyType: 'done',
            onKeyPress: (event) => {
              if (event.nativeEvent.key === 'Escape') close();
            },
          }}
        />
        <Row align="center" gap={8}>
          <Button
            label="Add channel"
            accessibilityLabel="Add channel"
            size="sm"
            color="primary"
            variant="solid"
            disabled={account === null || problem !== null}
            loading={creating}
            aria-busy={creating}
            onPress={() => {
              void submit();
            }}
          />
          <Button
            uniform
            size="sm"
            variant="borderless"
            accessibilityLabel="Cancel"
            disabled={creating}
            iconStart={<Glyph icon={IconCrossMedium} size={20} color={text} />}
            onPress={close}
          />
        </Row>
      </Column>
    </Column>
  );
}
