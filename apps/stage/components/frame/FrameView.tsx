import { Component, useEffect, useRef, type ReactNode } from 'react';
import type { A2uiClient, TransportMetadata } from '@stage-labs/kit/a2ui/client';
import type { ActionEvent, RendererMessage } from '@stage-labs/kit/a2ui/protocol';
import { A2uiSurface } from '@stage-labs/kit/react-native/a2ui-surface';
import { Text } from '@stage-labs/kit/react-native/text';
import type { SpacingValue } from '@stage-labs/kit/layout';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { report } from '../../lib/errorPolicy';
import { frameSession, rejectAgentCall, setFrameSessionHost, type FrameSessionHost } from '../../lib/frameSession';
import { usePalette } from '../../lib/theme';
import { Column } from '../layout';
import { frameMediaUrl, type FrameMessageHandler, type FrameNav, type FrameOut } from './frame.model';

export interface FrameNavigation {
  screen: string;
  depth: number;
  navigate: (nav: FrameNav) => void;
}

type NoticeReason = 'render' | 'no-screen';

const NOTICE: Record<NoticeReason, string> = {
  render: 'This frame could not be shown.',
  'no-screen': 'This screen is not in the frame.',
};

function FrameNotice({ reason }: { reason: NoticeReason }): React.ReactElement {
  const { border } = usePalette();
  const side = { width: 1, color: border };
  return (
    <Column padding={12} radius="lg" border={{ top: side, right: side, bottom: side, left: side }}>
      <Text variant="caption" size="md" text={NOTICE[reason]} />
    </Column>
  );
}

class FrameBoundary extends Component<{ resetKey: unknown; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidUpdate(prev: { resetKey: unknown }): void {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  override render(): ReactNode {
    return this.state.failed ? <FrameNotice reason="render" /> : this.props.children;
  }
}

function tapLabel(client: A2uiClient, event: ActionEvent): string | undefined {
  if (event.userMessage !== undefined) return event.userMessage;
  const components = client.surface(event.surfaceId)?.components;
  const child = components?.get(event.sourceComponentId)?.child;
  const text = typeof child === 'string' ? components?.get(child)?.text : undefined;
  return typeof text === 'string' ? text : undefined;
}

function outOf(message: RendererMessage, client: A2uiClient, metadata: TransportMetadata | undefined): FrameOut {
  const label = 'action' in message ? tapLabel(client, message.action) : undefined;
  return { message, ...(metadata === undefined ? {} : { metadata }), ...(label === undefined ? {} : { label }) };
}

interface FrameViewProps {
  frame: FrameContent;
  sessionKey: string;
  navigation: FrameNavigation;
  onMessage?: FrameMessageHandler;
  answersFunctions?: boolean;
  disabled?: boolean;
  padding?: SpacingValue;
  onOpenUrl?: (url: string) => void;
}

function useSessionHost(sessionKey: string, props: FrameViewProps): void {
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  useEffect(() => {
    const host: FrameSessionHost = {
      send: (message, client, metadata) => {
        const { onMessage, answersFunctions = false } = latest.current;
        if ('callAgentFunction' in message && (!answersFunctions || onMessage === undefined)) {
          rejectAgentCall(sessionKey, message.callAgentFunction.functionCallId);
          return;
        }
        void Promise.resolve(onMessage?.(outOf(message, client, metadata))).catch((err: unknown) => { report('frame.message', err); });
      },
      navigate: (nav) => { latest.current.navigation.navigate(nav); },
      openUrl: (url) => { latest.current.onOpenUrl?.(url); },
    };
    return setFrameSessionHost(sessionKey, host);
  }, [sessionKey]);
}

export function FrameView(props: FrameViewProps): React.ReactElement {
  const { frame, sessionKey, navigation, disabled, padding } = props;
  const client = frameSession(sessionKey, frame);
  useSessionHost(sessionKey, props);
  const shown = client.surface(navigation.screen) !== undefined;
  return (
    <Column padding={padding}>
      <FrameBoundary resetKey={client}>
        {shown ? <A2uiSurface client={client} surfaceId={navigation.screen} disabled={disabled} mediaUrl={frameMediaUrl} /> : <FrameNotice reason="no-screen" />}
      </FrameBoundary>
    </Column>
  );
}
