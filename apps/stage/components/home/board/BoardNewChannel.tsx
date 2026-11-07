import { useWindowDimensions, type TextStyle } from 'react-native';
import type { GroupKey } from '@stage-labs/client/xmtp/sync/homeView';
import { fontName, fontSize } from '@stage-labs/kit/tokens';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { FormField, useFocusOnOpen } from '../../FormField';
import { Avatar } from '../../Avatar';
import { WRAPPED_TITLE_LINE_HEIGHT } from '../../chatRow/ChannelRow.model';
import { HoverIconButton } from '../../hover';
import type { MarkedNode } from '../../keys/keys.model';
import { Column, Row, PAGE_GUTTER } from '../../layout';
import { usePalette } from '../../../lib/theme';
import { useChannelFields } from '../../../lib/channelFields';
import { boardChannelRows, type BoardPendingChannel } from './BoardNewChannel.model';
import { useBoardChannelCreation } from './useBoardChannelCreation';
import { CARD_GAP, COLUMN_PADDING } from './BoardColumnEdit';
import { BoardCardFrame } from './BoardCardFrame';
import { ColumnCards, type ColumnCardsProps } from './BoardCard';

const TITLE_INPUT_STYLE: TextStyle = {
  minHeight: WRAPPED_TITLE_LINE_HEIGHT,
  lineHeight: WRAPPED_TITLE_LINE_HEIGHT,
  fontSize: fontSize('md'),
  fontFamily: fontName.sans,
  paddingHorizontal: 0,
  paddingVertical: 0,
  borderRadius: 0,
  includeFontPadding: false,
  textAlignVertical: 'center',
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
  rowIds: ReadonlySet<string>;
  drafting: boolean;
  onClose: () => void;
}

type BoardCreation = ReturnType<typeof useBoardChannelCreation>;

function TitleCard({
  children,
  pending = false,
  mark,
}: {
  children: React.ReactNode;
  pending?: boolean;
  mark: MarkedNode;
}): React.ReactElement {
  const { border } = usePalette();
  const fields = useChannelFields('board');
  return (
    <BoardCardFrame pending={pending} mark={mark}>
      <Row padding={{ x: PAGE_GUTTER, y: 9 }} align="center" gap={12}>
        {fields.avatar ? <Avatar size={44} square style={{ backgroundColor: border }} /> : null}
        <Column weight={1} minWidth={0}>
          {children}
        </Column>
      </Row>
    </BoardCardFrame>
  );
}

function NewChannelCard({ creation, columnKey }: { creation: BoardCreation; columnKey: string }): React.ReactElement {
  const { text, link } = usePalette();
  const { fontScale } = useWindowDimensions();
  const input = useFocusOnOpen();
  const submit = creation.submit;
  return (
    <Column gap={CARD_GAP} padding={{ right: COLUMN_PADDING }}>
      <TitleCard mark={{ dataSet: { boarddraft: columnKey } }}>
        <FormField
          appearance="plain"
          style={{ ...TITLE_INPUT_STYLE, height: WRAPPED_TITLE_LINE_HEIGHT * fontScale, color: link }}
          value={creation.name}
          onChangeText={creation.changeName}
          inputRef={input}
          autoFocus
          rows={1}
          onSubmit={submit}
          inputProps={{
            accessibilityLabel: 'Channel name',
            returnKeyType: 'done',
            onKeyPress: (event) => {
              if (event.nativeEvent.key === 'Escape') creation.close();
            },
          }}
        />
      </TitleCard>
      {creation.note === null ? null : <Text text={creation.note} size="2xs" color="danger" style={{ paddingHorizontal: PAGE_GUTTER }} />}
      <Row align="center" gap={8}>
        <Button
          label="Add"
          accessibilityLabel="Add"
          size="sm"
          color="primary"
          variant="solid"
          disabled={creation.disabled}
          onPress={submit}
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
    </Column>
  );
}

function PendingChannelCard({ pending, creation }: { pending: BoardPendingChannel; creation: BoardCreation }): React.ReactElement {
  return (
    <Column gap={CARD_GAP}>
      <TitleCard pending={pending.error === null} mark={{ dataSet: { boardpending: String(pending.id) } }}>
        <Text text={pending.name} size="md" fontWeight="medium" color="link" style={{ lineHeight: WRAPPED_TITLE_LINE_HEIGHT }} />
      </TitleCard>
      {pending.error === null ? null : (
        <>
          <Text text={pending.error} size="2xs" color="danger" style={{ paddingHorizontal: PAGE_GUTTER }} />
          <Row align="center" gap={8}>
            <Button
              label="Retry"
              accessibilityLabel={`Retry ${pending.name}`}
              size="sm"
              color="primary"
              variant="solid"
              onPress={() => {
                creation.retry(pending);
              }}
            />
            <Button
              label="Cancel"
              accessibilityLabel={`Dismiss ${pending.name}`}
              size="sm"
              variant="borderless"
              onPress={() => {
                creation.dismiss(pending.id);
              }}
            />
          </Row>
        </>
      )}
    </Column>
  );
}

export function BoardNewChannel(props: BoardNewChannelProps): React.ReactElement {
  const creation = useBoardChannelCreation(props);
  const column = { ...props.column, rows: boardChannelRows(props.column.rows, creation.state) };
  const leading =
    creation.pending.length === 0
      ? undefined
      : creation.pending.map((pending) => <PendingChannelCard key={pending.id} pending={pending} creation={creation} />);
  return (
    <>
      {props.drafting ? <NewChannelCard key={creation.editorKey} creation={creation} columnKey={column.key} /> : null}
      <ColumnCards {...props} column={column} leading={leading} />
    </>
  );
}
