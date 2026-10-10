import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { loadNode, newNodeKey, nodeUrlOf } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { FrameSurface } from '../frame/FramePreview';
import { frameIsFullWidth } from '../frame/frame.model';
import { Col } from '../layout';
import { capabilities } from '../../lib/capabilities';
import { addLiveToDashboard } from '../../lib/dashboard';
import { report } from '../../lib/errorPolicy';
import { seedLiveWidget } from '../../lib/liveWidget';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { FRAME_ADD_TOASTS } from './dashboard.model';
import { EMPTY_LIVE, NODE_URL_HINTS, liveProblemText, liveStateAfter, type LiveState } from './liveWidget.model';

const NOTE = 'The widget loads from this link and refreshes every minute while you look at it. '
  + 'The site sees your IP and a key made for this widget, never your account.';

interface Preview { url: string; host: string; frame: FrameContent; state: LiveState }

function buttonLabel(busy: boolean, ready: boolean): string {
  if (busy) return 'Loading…';
  return ready ? 'Add widget' : 'Preview';
}

function previewOf(url: string, host: string, state: LiveState): Preview | string {
  const problem = liveProblemText(state);
  if (problem !== null || state.frame === null) return `Could not load it: ${(problem ?? 'no widget').toLowerCase()}`;
  return { url, host, frame: state.frame, state };
}

function AddLiveForm({ onDone }: { onDone: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [key] = useState(newNodeKey);
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const node = nodeUrlOf(text);
  const ready = preview !== null && node.ok && preview.url === node.url;

  const load = async (): Promise<void> => {
    if (!node.ok) { setHint(NODE_URL_HINTS[node.problem]); return; }
    setBusy(true);
    setPreview(null);
    const loaded = previewOf(node.url, node.host, liveStateAfter(EMPTY_LIVE, await loadNode(node.url, key), Date.now()));
    setBusy(false);
    if (typeof loaded === 'string') setHint(loaded);
    else setPreview(loaded);
  };

  const add = async (picked: Preview): Promise<void> => {
    setBusy(true);
    try {
      const { outcome, id } = await addLiveToDashboard({ url: picked.url, key }, frameIsFullWidth(picked.frame) ? 'full' : 'half');
      if (outcome === 'added') seedLiveWidget(id, picked.url, picked.state);
      capabilities.toast(FRAME_ADD_TOASTS[outcome]);
      onDone();
    } catch (err) {
      report('dashboard.addLive', err);
      capabilities.toast('Could not add it to your dashboard');
      setBusy(false);
    }
  };

  const submit = (): void => {
    if (busy) return;
    void (ready ? add(preview) : load());
  };

  return (
    <Col gap={12}>
      <FormField
        label="Link" placeholder="https://" value={text} inputType="url" autoFocus disabled={busy} onSubmit={submit}
        onChangeText={(value) => { setText(value); setHint(null); }} inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        hint={hint ?? undefined} hintTone="danger"
      />
      {ready ? (
        <Col gap={6}>
          <Text value={`From ${preview.host}`} size="xs" color="secondary" truncate />
          <FrameSurface frame={preview.frame} stackId={`preview:${key}`} />
        </Col>
      ) : null}
      <Text value={NOTE} size="xs" color="secondary" />
      <Button
        label={buttonLabel(busy, ready)} block size="lg" color="primary" variant="solid" dark={dark}
        disabled={busy || text.trim() === ''} onPress={submit}
      />
    </Col>
  );
}

export function AddLiveWidgetButton({ disabled }: { disabled: boolean }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link } = usePalette();
  const [open, setOpen] = useState(false);
  const close = (): void => { setOpen(false); };
  return (
    <>
      <Button
        size="md" color="secondary" variant="solid" dark={dark} label="Add from URL" disabled={disabled}
        iconStart={<Glyph icon={IconPlusLarge} size={18} color={link} />} onPress={() => { setOpen(true); }}
      />
      <AppModal visible={open} onClose={close} title="Add widget from URL">
        {open ? <AddLiveForm onDone={close} /> : null}
      </AppModal>
    </>
  );
}
