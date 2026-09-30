import { useEffect } from 'react';
import { startCallService } from '../../lib/calls';
import { useActiveAccount } from '../../modules/messaging';
import { useCallView } from '../../lib/calls.store';
import { CallScreen } from './CallScreen';
import { IncomingCall } from './IncomingCall';

export function CallHost({ active }: { active: boolean }): React.ReactElement | null {
  const view = useCallView();
  const account = useActiveAccount();
  useEffect(() => (active ? startCallService() : undefined), [active, account]);
  const session = view.calls.session;
  if (!active || session === null) return null;
  if (session.phase === 'ringing') {
    return <IncomingCall session={session} info={view.calls.calls[session.convId]} selfInboxId={view.selfInboxId}/>;
  }
  return <CallScreen view={view} session={session}/>;
}
