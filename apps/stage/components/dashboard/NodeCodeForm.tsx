import { useEffect, useRef, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { loadNode, newNodeKey, nodeUrlOf, type NodeResult } from '@stage-labs/client/nodes/protocol';
import { deleteNode, publishNode } from '@stage-labs/client/nodes/publish';
import { FormField } from '../FormField';
import { FrameSurface } from '../frame/FramePreview';
import { frameIsFullWidth } from '../frame/frame.model';
import { Box, Col, Row } from '../layout';
import { capabilities } from '../../lib/capabilities';
import { addLiveToDashboard } from '../../lib/dashboard';
import { ignore, report } from '../../lib/errorPolicy';
import { linkProxyBase } from '../../lib/linkProxy';
import { seedLiveWidget } from '../../lib/liveWidget';
import { useEffectiveColorScheme } from '../../lib/theme';
import { FRAME_ADD_TOASTS } from './dashboard.model';
import { EMPTY_LIVE, livePreviewOf, liveStateAfter, publishProblemText, type LivePreview } from './liveWidget.model';

const NOTE = 'Stage runs this code at nodes.stage.box in its own sandbox: no secrets, only public https calls, '
  + '50 ms of CPU and 5 requests per call. Anyone with the link can call it. Removing the widget deletes the node.';
const PLACEHOLDER = "export default {\n  fetch: () => Response.json({ type: 'Card', children: [{ type: 'Text', value: 'Hello' }] }),\n};";

const FRESH_RETRY_MS = 2_000;

interface Published extends LivePreview { code: string }

function buttonLabel(busy: boolean, ready: boolean): string {
  if (busy) return ready ? 'Adding…' : 'Publishing…';
  return ready ? 'Add widget' : 'Publish';
}

async function loadFresh(url: string, key: string): Promise<NodeResult> {
  const first = await loadNode(url, key);
  if (first.ok || first.status !== 404) return first;
  await new Promise((resolve) => { setTimeout(resolve, FRESH_RETRY_MS); });
  return loadNode(url, key);
}

async function publishAndLoad(key: string, code: string): Promise<Published | string> {
  const published = await publishNode(linkProxyBase(), key, code);
  if (!published.ok) return publishProblemText(published.problem, published.detail);
  const node = nodeUrlOf(published.url);
  if (!node.ok) return publishProblemText('failed');
  const preview = livePreviewOf(node.url, node.host, liveStateAfter(EMPTY_LIVE, await loadFresh(node.url, key), Date.now()));
  return typeof preview === 'string' ? `Published, but ${preview.charAt(0).toLowerCase()}${preview.slice(1)}` : { ...preview, code };
}

function useUnaddedNodeCleanup(key: string): { track: (work: Promise<unknown>) => void; keep: () => void } {
  const pending = useRef<Promise<unknown> | null>(null);
  useEffect(() => () => {
    const work = pending.current;
    const remove = (): Promise<boolean> => deleteNode(linkProxyBase(), key);
    if (work !== null) ignore(work.then(remove, remove), 'cleanup');
  }, [key]);
  return {
    track: (work) => { pending.current = work; },
    keep: () => { pending.current = null; },
  };
}

function PublishedNode({ node, stackId }: { node: Published; stackId: string }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Col gap={6}>
      <Row align="center" gap={8}>
        <Box flex={1} minWidth={0}><Text value={node.url} size="xs" color="secondary" truncate /></Box>
        <Button label="Copy link" size="sm" color="secondary" variant="ghost" dark={dark} onPress={() => { capabilities.copy('Link', node.url); }} />
      </Row>
      <FrameSurface frame={node.frame} stackId={stackId} />
    </Col>
  );
}

export function NodeCodeForm({ onDone }: { onDone: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [key] = useState(newNodeKey);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Published | null>(null);
  const cleanup = useUnaddedNodeCleanup(key);
  const ready = published !== null && published.code === code;

  const publish = async (): Promise<void> => {
    setBusy(true);
    setPublished(null);
    const work = publishAndLoad(key, code);
    cleanup.track(work);
    const outcome = await work;
    setBusy(false);
    if (typeof outcome === 'string') setHint(outcome);
    else setPublished(outcome);
  };

  const add = async (node: Published): Promise<void> => {
    setBusy(true);
    try {
      const { outcome, id } = await addLiveToDashboard({ url: node.url, key }, frameIsFullWidth(node.frame) ? 'full' : 'half');
      if (outcome === 'added') {
        cleanup.keep();
        seedLiveWidget(id, node.url, node.state);
      }
      capabilities.toast(FRAME_ADD_TOASTS[outcome]);
      onDone();
    } catch (err) {
      report('dashboard.addNode', err);
      capabilities.toast('Could not add it to your dashboard');
      setBusy(false);
    }
  };

  const submit = (): void => {
    if (busy || code.trim() === '') return;
    void (ready ? add(published) : publish());
  };

  return (
    <Col gap={12}>
      <FormField
        label="Code" placeholder={PLACEHOLDER} value={code} multiline rows={8} autoFocus disabled={busy}
        onChangeText={(value) => { setCode(value); setHint(null); }}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false, spellCheck: false }}
        hint={hint ?? undefined} hintTone="danger"
      />
      {ready ? <PublishedNode node={published} stackId={`node:${key}`} /> : null}
      <Text value={NOTE} size="xs" color="secondary" />
      <Button
        label={buttonLabel(busy, ready)} block size="lg" color="primary" variant="solid" dark={dark}
        disabled={busy || code.trim() === ''} onPress={submit}
      />
    </Col>
  );
}
