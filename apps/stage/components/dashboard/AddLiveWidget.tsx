import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { newNodeKey, nodeUrlOf } from '@stage-labs/client/nodes/protocol';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { FrameSurface } from '../frame/FramePreview';
import { LabelChip } from '../LabelChip';
import { addLivePreview } from '../../lib/frames/addToDashboard';
import { frameKeysOf } from '../../lib/frames/frameKeys';
import type { LivePreview } from '../../lib/frames/live.model';
import { frameNodes } from '../../lib/frames/nodeTransport';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { NODE_URL_HINTS, livePreviewOf } from './liveWidget.model';
import { NodeCodeForm } from './NodeCodeForm';
import { Column, Row } from '../layout';

const NOTE =
  'The widget loads from this link and refreshes every minute while you look at it. ' +
  'The site sees your IP and a key made for this widget, never your account.';

type AddMode = 'link' | 'code';

const MODES: readonly { value: AddMode; label: string; title: string }[] = [
  { value: 'link', label: 'Link', title: 'Add widget from URL' },
  { value: 'code', label: 'Code', title: 'Create node' },
];

function buttonLabel(busy: boolean, ready: boolean): string {
  if (busy) return 'Loading…';
  return ready ? 'Add widget' : 'Preview';
}

function ModePicker({ mode, onChange }: { mode: AddMode; onChange: (mode: AddMode) => void }): React.ReactElement {
  return (
    <Row gap={8}>
      {MODES.map(({ value, label }) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === value }}
          onPress={() => {
            onChange(value);
          }}
        >
          <LabelChip label={label} selected={mode === value} />
        </Pressable>
      ))}
    </Row>
  );
}

function AddLiveForm({ onDone }: { onDone: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [key] = useState(newNodeKey);
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LivePreview | null>(null);
  const node = nodeUrlOf(text);
  const ready = preview !== null && node.ok && preview.url === node.url;

  const load = async (): Promise<void> => {
    if (!node.ok) {
      setHint(NODE_URL_HINTS[node.problem]);
      return;
    }
    setBusy(true);
    setPreview(null);
    const loaded = livePreviewOf(node, await frameNodes.load({ url: node.url, key }), Date.now());
    setBusy(false);
    if (typeof loaded === 'string') setHint(loaded);
    else setPreview(loaded);
  };

  const add = async (picked: LivePreview): Promise<void> => {
    setBusy(true);
    if ((await addLivePreview(picked, key)) === null) setBusy(false);
    else onDone();
  };

  const submit = (): void => {
    if (busy) return;
    void (ready ? add(preview) : load());
  };

  return (
    <Column gap={12}>
      <FormField
        label="Link"
        placeholder="https://"
        value={text}
        inputType="url"
        autoFocus
        disabled={busy}
        onSubmit={submit}
        onChangeText={(value) => {
          setText(value);
          setHint(null);
        }}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        hint={hint ?? undefined}
        hintTone="danger"
      />
      {ready ? (
        <Column gap={6}>
          <Text text={`From ${preview.host}`} size="xs" color="secondary" truncate />
          <FrameSurface frame={preview.frame} keys={frameKeysOf({ kind: 'linkPreview', nodeKey: key })} />
        </Column>
      ) : null}
      <Text text={NOTE} size="xs" color="secondary" />
      <Button
        label={buttonLabel(busy, ready)}
        block
        size="lg"
        color="primary"
        variant="solid"
        dark={dark}
        disabled={busy || text.trim() === ''}
        onPress={submit}
      />
    </Column>
  );
}

export function AddLiveWidgetButton({ disabled }: { disabled: boolean }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link } = usePalette();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>('link');
  const close = (): void => {
    setOpen(false);
    setMode('link');
  };
  return (
    <>
      <Button
        size="md"
        color="secondary"
        variant="solid"
        dark={dark}
        label="Add from URL"
        disabled={disabled}
        iconStart={<Glyph icon={IconPlusLarge} size={18} color={link} />}
        onPress={() => {
          setOpen(true);
        }}
      />
      <AppModal visible={open} onClose={close} title={MODES.find((item) => item.value === mode)?.title}>
        {open ? (
          <Column gap={12}>
            <ModePicker mode={mode} onChange={setMode} />
            {mode === 'link' ? <AddLiveForm onDone={close} /> : <NodeCodeForm onDone={close} />}
          </Column>
        ) : null}
      </AppModal>
    </>
  );
}
