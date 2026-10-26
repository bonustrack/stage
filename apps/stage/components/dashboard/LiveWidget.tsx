import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { nodeUrlOf } from '@stage-labs/client/nodes/protocol';
import type { LiveSource } from '@stage-labs/client/xmtp/readState';
import type { MenuPoint } from '../AnchoredMenu.model';
import { FrameSurface } from '../frame/FramePreview';
import type { FrameMessageHandler } from '../frame/frame.model';
import { channelTimestamp } from '../../lib/format';
import { liveWidgetKey, useLiveWidget } from '../../lib/liveWidget';
import { liveProblemText, liveStatusText, type LiveState } from './liveWidget.model';
import { Unavailable, WidgetHeader, type WidgetGrip } from './widgetParts';
import { Column } from '../layout';

const BLOCKED = 'This link is blocked';
const NOT_LOADED = 'Could not load this widget';

interface WidgetChrome { onMenu: (anchor: MenuPoint) => void; grip: WidgetGrip }

function LiveBody({ widgetId, state, act }: { widgetId: string; state: LiveState | undefined; act: FrameMessageHandler }): React.ReactElement {
  if (state?.frame === null || state?.frame === undefined) {
    const problem = state === undefined ? null : liveProblemText(state);
    if (problem === null) return <Column weight={1} align="center" justify="center"><Spinner /></Column>;
    return <Unavailable title={NOT_LOADED} detail={problem} />;
  }
  return <FrameSurface frame={state.frame} stackId={liveWidgetKey(widgetId)} onMessage={act} answersFunctions fill />;
}

function NodeWidget({ widgetId, source, host, onMenu, grip }: WidgetChrome & {
  widgetId: string; source: LiveSource; host: string;
}): React.ReactElement {
  const { state, act } = useLiveWidget(widgetId, source);
  return (
    <Column weight={1} gap={6}>
      {grip(<WidgetHeader title={host} status={liveStatusText(state, channelTimestamp)} onMenu={onMenu} />)}
      <LiveBody widgetId={widgetId} state={state} act={act} />
    </Column>
  );
}

export function LiveWidget({ widgetId, source, onMenu, grip }: WidgetChrome & { widgetId: string; source: LiveSource }): React.ReactElement {
  const node = nodeUrlOf(source.url);
  if (node.ok) return <NodeWidget widgetId={widgetId} source={{ ...source, url: node.url }} host={node.host} onMenu={onMenu} grip={grip} />;
  return (
    <Column weight={1} gap={6}>
      {grip(<WidgetHeader title={source.url} onMenu={onMenu} />)}
      <Unavailable title={BLOCKED} />
    </Column>
  );
}
