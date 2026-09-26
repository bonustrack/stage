import { useRef, useState } from 'react';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Input } from '@stage-labs/kit/react-native/input';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT, fontName, fontSize } from '@stage-labs/kit/tokens';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { Col, Row } from '../layout';
import { FORM_FIELD_RADIUS, useFieldColors } from '../FormField';
import { HoverTooltip } from '../HoverTooltip';
import { OverflowMenu } from '../MenuRows';
import { useHover } from '../hover';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  BOARD_COLUMN_WIDTH, addColumnProblem, draftEdit, draftNote, renameEdit, renameNote, type BoardColumn, type TitleCommit,
  type TitleEdit,
} from './BoardScreen.model';
import { addBoardColumn } from './boardActions';

export const COLUMN_PADDING = 10;
export const CARD_GAP = 8;
export const TITLE_SIZE = '2xl';
export const HEADER_PADDING = { left: 4, right: 4 + COLUMN_PADDING, y: 2 };

type Columns = readonly BoardColumn<unknown>[];

interface TitleEditState {
  name: string;
  tried: boolean;
  setName: (name: string) => void;
  finish: (via: TitleCommit) => void;
  close: () => void;
}

function useTitleEdit(
  initial: string, decide: (name: string, via: TitleCommit) => TitleEdit, onSave: (name: string) => void,
  onClose: () => void,
): TitleEditState {
  const [name, setName] = useState(initial);
  const [tried, setTried] = useState(false);
  const done = useRef(false);
  const close = (): void => {
    if (done.current) return;
    done.current = true;
    onClose();
  };
  const finish = (via: TitleCommit): void => {
    if (done.current) return;
    const edit = decide(name, via);
    if (edit.kind === 'stay') {
      setTried(true);
      return;
    }
    if (edit.kind === 'save') onSave(edit.name);
    close();
  };
  return { name, tried, setName, finish, close };
}

export function ColumnFrame({ nativeID, over = false, opacity = 1, maxHeight, children }: {
  nativeID?: string; over?: boolean; opacity?: number; maxHeight?: number | string; children: React.ReactNode;
}): React.ReactElement {
  const { border, link } = usePalette();
  return (
    <Col
      nativeID={nativeID}
      surface="toolbar"
      radius={BLOCK_RADIUS_DEFAULT}
      padding={{ top: COLUMN_PADDING, bottom: COLUMN_PADDING, left: COLUMN_PADDING }}
      gap={CARD_GAP}
      width={BOARD_COLUMN_WIDTH}
      maxHeight={maxHeight}
      style={{ borderWidth: 1, borderColor: over ? link : border, opacity }}
    >
      {children}
    </Col>
  );
}

const COLUMN_MENU = [{ id: 'delete', label: 'Delete column', icon: IconTrashCan, danger: true }];

export function ColumnMenu({ onDelete }: { onDelete: () => void }): React.ReactElement {
  const { text } = usePalette();
  return <OverflowMenu color={text} label="Column menu" items={COLUMN_MENU} onSelect={onDelete} size={16}/>;
}

function TitleInput({ edit, placeholder }: { edit: TitleEditState; placeholder?: string }): React.ReactElement {
  const colors = useFieldColors();
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Input
      autoFocus
      autoSelect
      dark={dark}
      radius={FORM_FIELD_RADIUS}
      value={edit.name}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      onChangeText={edit.setName}
      onSubmit={() => { edit.finish('enter'); }}
      inputProps={{
        blurOnSubmit: false,
        onBlur: () => { edit.finish('blur'); },
        onKeyPress: (e) => { if (e.nativeEvent.key === 'Escape') edit.close(); },
      }}
      style={{
        flex: 1, minWidth: 0, minHeight: 0, marginLeft: -4, paddingHorizontal: 4, paddingVertical: 1,
        color: colors.text, backgroundColor: colors.background, borderWidth: 0,
        fontSize: fontSize(TITLE_SIZE), fontFamily: fontName.head,
      }}
    />
  );
}

function TitleNote({ note }: { note: string | null }): React.ReactElement | null {
  if (note === null) return null;
  return <Text value={note} size="sm" color="secondary" style={{ paddingLeft: 4, paddingRight: COLUMN_PADDING }}/>;
}

export function RenameHeading({ label, columns, count, onRename, onClose }: {
  label: string; columns: Columns; count: number; onRename: (from: string, to: string) => void; onClose: () => void;
}): React.ReactElement {
  const edit = useTitleEdit(
    label, (name, via) => renameEdit(columns, label, name, via), (name) => { onRename(label, name); }, onClose,
  );
  return (
    <>
      <Row align="center" gap={8} padding={HEADER_PADDING}>
        <TitleInput edit={edit}/>
        <Badge label={String(count)} color="secondary" variant="soft" pill/>
      </Row>
      <TitleNote note={renameNote(columns, label, edit.name, edit.tried)}/>
    </>
  );
}

function CancelButton({ onCancel }: { onCancel: () => void }): React.ReactElement {
  const { text, link } = usePalette();
  const hover = useHover();
  return (
    <HoverTooltip label="Cancel" placement="below">
      <Pressable onPointerDown={onCancel} onPress={onCancel} hitSlop={8} accessibilityLabel="Cancel" {...hover.hoverProps}>
        <Glyph icon={IconCrossMedium} size={20} color={hover.hovered ? link : text}/>
      </Pressable>
    </HoverTooltip>
  );
}

function DraftColumn({ columns, saved, onAdded, onClose }: {
  columns: Columns; saved: readonly string[]; onAdded: () => void; onClose: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const edit = useTitleEdit('', (name, via) => draftEdit(columns, name, via), (name) => {
    addBoardColumn(columns, saved, name);
    onAdded();
  }, onClose);
  return (
    <ColumnFrame>
      <Row align="center" padding={{ ...HEADER_PADDING, right: COLUMN_PADDING }}>
        <TitleInput edit={edit} placeholder="Column name"/>
      </Row>
      <TitleNote note={draftNote(columns, edit.name, edit.tried)}/>
      <Row align="center" gap={12} padding={{ right: COLUMN_PADDING }}>
        <Button
          label="Add column" size="sm" color="primary" variant="solid" dark={dark}
          disabled={addColumnProblem(columns, edit.name) !== null}
          onPress={() => { edit.finish('enter'); }}
        />
        <CancelButton onCancel={edit.close}/>
      </Row>
    </ColumnFrame>
  );
}

function AddColumnButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const { text, link } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const hover = useHover();
  return (
    <HoverTooltip label="Add column" placement="below">
      <Button
        uniform color="secondary" variant="outline" dark={dark}
        accessibilityLabel="Add column"
        style={hover.hovered ? { borderColor: link } : undefined}
        iconStart={<Glyph icon={IconPlusLarge} size={20} color={hover.hovered ? link : text}/>}
        onPress={onPress}
        {...hover.hoverProps}
      />
    </HoverTooltip>
  );
}

export function AddColumn({ columns, saved, onReveal }: {
  columns: Columns; saved: readonly string[]; onReveal: () => void;
}): React.ReactElement {
  const [drafting, setDrafting] = useState(false);
  if (!drafting) return <AddColumnButton onPress={() => { onReveal(); setDrafting(true); }}/>;
  return <DraftColumn columns={columns} saved={saved} onAdded={onReveal} onClose={() => { setDrafting(false); }}/>;
}
