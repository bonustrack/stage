import { useIsFocused } from 'expo-router';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { nodeUrlOf } from '@stage-labs/client/nodes/protocol';
import type { LiveSource } from '@stage-labs/client/xmtp/sync/dashboard';
import type { MenuPoint } from '../AnchoredMenu.model';
import { FrameHeader } from '../frame/FrameHeader';
import { FrameSurface } from '../frame/FramePreview';
import { isAppInFront, subscribeAppInFront } from '../../lib/appInFront';
import { channelTimestamp } from '../../lib/format';
import { liveProblemText } from '../../lib/frames/live.model';
import { useLiveWidget, type LiveWidgetHandle } from '../../lib/frames/liveWidget';
import { useStoreValue } from '../../lib/storeCore';
import { liveStatusText } from './liveWidget.model';
import { Unavailable, type WidgetGrip } from './widgetParts';
import { Column } from '../layout';

const BLOCKED = 'This link is blocked';
const NOT_LOADED = 'Could not load this widget';

interface WidgetChrome {
  onMenu: (anchor: MenuPoint) => void;
  grip: WidgetGrip;
}

function useLiveActive(): boolean {
  const focused = useIsFocused();
  const inFront = useStoreValue(subscribeAppInFront, isAppInFront);
  return focused && inFront;
}

function LiveBody({ live: { keys, state, act } }: { live: LiveWidgetHandle }): React.ReactElement {
  if (state?.frame === null || state?.frame === undefined) {
    const problem = state === undefined ? null : liveProblemText(state);
    if (problem === null)
      return (
        <Column weight={1} align="center" justify="center">
          <Spinner />
        </Column>
      );
    return <Unavailable title={NOT_LOADED} detail={problem} />;
  }
  return <FrameSurface frame={state.frame} keys={keys} onMessage={act} fill />;
}

function NodeWidget({
  widgetId,
  source,
  host,
  onMenu,
  grip,
}: WidgetChrome & { widgetId: string; source: LiveSource; host: string }): React.ReactElement {
  const active = useLiveActive();
  const live = useLiveWidget(widgetId, source, active);
  return (
    <Column weight={1} gap={6}>
      {grip(<FrameHeader title={host} status={liveStatusText(live.state, channelTimestamp)} onMenu={onMenu} />)}
      <LiveBody live={live} />
    </Column>
  );
}

export function LiveWidget({
  widgetId,
  source,
  onMenu,
  grip,
}: WidgetChrome & { widgetId: string; source: LiveSource }): React.ReactElement {
  const node = nodeUrlOf(source.url);
  if (node.ok) return <NodeWidget widgetId={widgetId} source={{ ...source, url: node.url }} host={node.host} onMenu={onMenu} grip={grip} />;
  return (
    <Column weight={1} gap={6}>
      {grip(<FrameHeader title={source.url} onMenu={onMenu} />)}
      <Unavailable title={BLOCKED} />
    </Column>
  );
}
