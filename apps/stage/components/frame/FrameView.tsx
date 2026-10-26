import { useEffect, useRef } from 'react';
import type { A2uiClient } from '@stage-labs/kit/a2ui/client';
import type { ActionEvent, RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { MEDIA_RENDERERS } from '@stage-labs/kit/react-native/a2ui-media';
import { A2uiSurface } from '@stage-labs/kit/react-native/a2ui-surface';
import { Text } from '@stage-labs/kit/react-native/text';
import type { SpacingValue } from '@stage-labs/kit/layout';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { report } from '../../lib/errorPolicy';
import {
  activateFrameSessionHost, frameSession, rejectAgentCall, releaseFrameSession, setFrameSessionHost, type FrameSessionHost,
} from '../../lib/frameSession';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { usePalette } from '../../lib/theme';
import { ResetBoundary } from '../bubble/boundary';
import { Column } from '../layout';
import { frameMediaUrl, type FrameMessageHandler, type FrameNav } from './frame.model';

export interface FrameNavigation {
  screen: string;
  depth: number;
  navigate: (nav: FrameNav) => void;
}

function FrameNotice({ text }: { text: string }): React.ReactElement {
  const { border } = usePalette();
  const side = { width: 1, color: border };
  return (
    <Column padding={12} radius="lg" border={{ top: side, right: side, bottom: side, left: side }}>
      <Text variant="caption" size="md" text={text} />
    </Column>
  );
}

function tapLabel(client: A2uiClient, event: ActionEvent): string | undefined {
  if (event.userMessage !== undefined) return event.userMessage;
  const components = client.surface(event.surfaceId)?.components;
  const child = components?.get(event.sourceComponentId)?.child;
  const text = typeof child === 'string' ? components?.get(child)?.text : undefined;
  return typeof text === 'string' ? text : undefined;
}

interface FrameViewProps {
  frame: FrameContent;
  sessionKey: string;
  navigation: FrameNavigation;
  onMessage?: FrameMessageHandler;
  untilTap?: boolean;
  disabled?: boolean;
  padding?: SpacingValue;
}

function accepts({ disabled = false, untilTap = false }: FrameViewProps, message: RendererMessage, engaged: boolean): boolean {
  if (!untilTap && 'callAgentFunction' in message) return true;
  return !disabled && (!untilTap || engaged || 'action' in message);
}

function useSessionHost(sessionKey: string, props: FrameViewProps): () => void {
  const latest = useRef(props);
  const host = useRef<FrameSessionHost | null>(null);
  useEffect(() => { latest.current = props; });
  useEffect(() => {
    host.current = {
      accepts: (message, engaged) => accepts(latest.current, message, engaged),
      send: (message, client, metadata) => {
        const { onMessage } = latest.current;
        if (onMessage === undefined) {
          if ('callAgentFunction' in message) rejectAgentCall(sessionKey, message.callAgentFunction.functionCallId);
          return;
        }
        const label = 'action' in message ? tapLabel(client, message.action) : undefined;
        void Promise.resolve(onMessage({ message, metadata, label })).catch((err: unknown) => { report('frame.message', err); });
      },
      navigate: (nav) => { latest.current.navigation.navigate(nav); },
      openUrl: (url) => { openInBubbleLink(url); },
    };
    return setFrameSessionHost(sessionKey, host.current);
  }, [sessionKey]);
  useEffect(() => { releaseFrameSession(sessionKey); }, [sessionKey, props.disabled]);
  return () => { if (host.current !== null) activateFrameSessionHost(sessionKey, host.current); };
}

export function FrameView(props: FrameViewProps): React.ReactElement {
  const { frame, sessionKey, navigation, disabled, padding } = props;
  const client = frameSession(sessionKey, frame);
  const activate = useSessionHost(sessionKey, props);
  return (
    <Column padding={padding} onStartShouldSetResponderCapture={() => { activate(); return false; }}>
      <ResetBoundary resetKey={client} fallback={() => <FrameNotice text="This frame could not be shown." />}>
        {client.surface(navigation.screen) === undefined
          ? <FrameNotice text="This screen is not in the frame." />
          : <A2uiSurface client={client} surfaceId={navigation.screen} renderers={MEDIA_RENDERERS} disabled={disabled} mediaUrl={frameMediaUrl}
              fallback={<FrameNotice text="This frame could not be shown." />} />}
      </ResetBoundary>
    </Column>
  );
}
