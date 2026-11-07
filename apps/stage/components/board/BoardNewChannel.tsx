import { useEffect, useRef, useState } from 'react';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { errorMessage } from '@stage-labs/client/errors';
import { fontName, fontSize } from '@stage-labs/kit/tokens';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { FormField, useFocusOnOpen } from '../FormField';
import { ChannelRow } from '../ChannelRow';
import { WRAPPED_TITLE_LINE_HEIGHT } from '../ChannelRow.model';
import { HoverIconButton } from '../hover';
import { Column, Row, PAGE_GUTTER } from '../layout';
import { usePalette } from '../../lib/theme';
import { createGroup } from '../../lib/xmtp.groups';
import { schedulePushTopicRefresh } from '../../lib/pushRegister';
import { useChannelFields } from '../../lib/channelFields';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { rememberOwnGroup } from '../../modules/messaging/useConvConsent';
import { boardChannelDraft, boardChannelNameProblem, boardChannelRows, type BoardPendingChannel } from './BoardNewChannel.model';
import { CARD_GAP, COLUMN_PADDING } from './BoardColumnEdit';
import { BoardCardFrame } from './BoardCardFrame';
import { ColumnCards, type ColumnCardsProps } from './BoardCard';
import type { BoardColumn } from './BoardScreen.model';
import type { Row as ChannelRowData } from '../home/model';

const TITLE_INPUT_STYLE = {
  minHeight: WRAPPED_TITLE_LINE_HEIGHT,
  lineHeight: WRAPPED_TITLE_LINE_HEIGHT,
  fontSize: fontSize('md'),
  fontFamily: fontName.sans,
  paddingHorizontal: 0,
  paddingVertical: 0,
  borderRadius: 0,
};

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

interface BoardNewChannelProps extends ColumnCardsProps {
  by: GroupKey;
  columns: readonly BoardColumn<ChannelRowData>[];
  onClose: () => void;
}

function useBoardChannelCreation({ by, column, columns, onClose }: BoardNewChannelProps) {
  const account = useActiveAccountRecord();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<BoardPendingChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const problem = boardChannelNameProblem(name);
  const confirmed = pending !== null && pending.convId !== null && column.rows.some((row) => row.convId === pending.convId);
  useEffect(() => {
    if (confirmed) onClose();
  }, [confirmed]);
  const close = (): void => {
    if (!busy.current) onClose();
  };
  const submit = async (): Promise<void> => {
    if (busy.current || account === null || problem !== null) return;
    busy.current = true;
    setCreating(true);
    setError(null);
    const draft = boardChannelDraft(by, column.key, column.label, name, account.address);
    const submitted = {
      name: draft.name,
      appData: draft.appData,
      existingIds: new Set(columns.flatMap((c) => c.rows.map((r) => r.convId))),
      convId: null,
    };
    setPending(submitted);
    schedulePushTopicRefresh(10_000);
    try {
      const created = await createGroup(draft.members, draft.appData, draft.name);
      rememberOwnGroup(created.id);
      setPending({ ...submitted, convId: created.id });
    } catch (err) {
      setError(errorMessage(err));
      busy.current = false;
      setCreating(false);
    }
  };
  return {
    name,
    changeName: (value: string): void => {
      setName(value);
      setError(null);
    },
    submitted: creating,
    pending,
    confirmed,
    note: error ?? (name.trim() === '' ? null : problem),
    disabled: account === null || problem !== null,
    close,
    submit,
  };
}

type BoardCreation = ReturnType<typeof useBoardChannelCreation>;

function NewChannelCard({ creation, columnKey }: { creation: BoardCreation; columnKey: string }): React.ReactElement {
  const { text, link } = usePalette();
  const fields = useChannelFields('board');
  const input = useFocusOnOpen();
  useEffect(() => {
    if (!creation.submitted) input.current?.focus();
  }, [creation.submitted]);
  const titleInput = creation.submitted ? undefined : (
    <Column weight={1} minWidth={0}>
      <FormField
        appearance="plain"
        style={{ ...TITLE_INPUT_STYLE, color: link }}
        value={creation.name}
        onChangeText={creation.changeName}
        inputRef={input}
        autoFocus
        onSubmit={() => {
          void creation.submit();
        }}
        inputProps={{
          accessibilityLabel: 'Channel name',
          returnKeyType: 'done',
          onKeyPress: (event) => {
            if (event.nativeEvent.key === 'Escape') creation.close();
          },
        }}
      />
    </Column>
  );
  return (
    <Column gap={CARD_GAP} padding={{ right: COLUMN_PADDING }}>
      <BoardCardFrame pending={creation.submitted} mark={{ dataSet: { boarddraft: columnKey } }}>
        <ChannelRow
          title={creation.pending?.name ?? creation.name}
          titleContent={titleInput}
          hideAvatar={!fields.avatar}
          square
          showPreview={false}
          wrapTitle
        />
      </BoardCardFrame>
      {creation.submitted ? null : (
        <>
          {creation.note === null ? null : (
            <Text text={creation.note} size="2xs" color="danger" style={{ paddingHorizontal: PAGE_GUTTER }} />
          )}
          <Row align="center" gap={8}>
            <Button
              label="Add"
              accessibilityLabel="Add"
              size="sm"
              color="primary"
              variant="solid"
              disabled={creation.disabled}
              onPress={() => {
                void creation.submit();
              }}
            />
            <Button
              uniform
              size="sm"
              variant="borderless"
              accessibilityLabel="Cancel"
              style={{ alignSelf: 'center' }}
              iconStart={<Glyph icon={IconCrossMedium} size={20} color={text} />}
              onPress={creation.close}
            />
          </Row>
        </>
      )}
    </Column>
  );
}

export function BoardNewChannel(props: BoardNewChannelProps): React.ReactElement {
  const creation = useBoardChannelCreation(props);
  const column = { ...props.column, rows: boardChannelRows(props.column.rows, creation.confirmed ? null : creation.pending) };
  return (
    <>
      {creation.confirmed ? null : <NewChannelCard creation={creation} columnKey={column.key} />}
      <ColumnCards {...props} column={column} />
    </>
  );
}
