import { useEffect } from 'react';
import { startCallService } from '../../lib/calls';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useCallMinimized, useCallView } from '../../lib/calls.store';
import { CallBubble } from './CallBubble';
import { CallMediaView } from './CallMediaView';
import { CallScreen } from './CallScreen';
import { IncomingCall } from './IncomingCall';

export function CallHost({ active }: { active: boolean }): React.ReactElement | null {
  const view = useCallView();
  const minimized = useCallMinimized();
  const account = useAccountEpoch();
  useEffect(() => (active ? startCallService() : undefined), [active, account]);
  const session = view.calls.session;
  if (!active || session === null) return null;
  if (session.phase === 'ringing') {
    return <IncomingCall session={session} info={view.calls.calls[session.convId]} selfInboxId={view.selfInboxId}/>;
  }
  return (
    <>
      {minimized ? <CallBubble view={view} session={session}/> : <CallScreen view={view} session={session}/>}
      {view.peers.map((p) => <CallMediaView key={p.peerId} stream={p.stream} kind="audio"/>)}
    </>
  );
}
