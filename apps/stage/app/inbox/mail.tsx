import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '../../components/chrome/EmptyState';
import { MailView } from '../../components/settings/MailView';
import { DeveloperModeGate } from '../../components/settings/DeveloperModeGate';

export default function MailRoute(): React.ReactElement {
  const { label, id } = useLocalSearchParams<{ label?: string; id?: string }>();
  return <DeveloperModeGate>{!label || !id
    ? <EmptyState title="This mail is not available." />
    : <MailView label={label} id={id} />}</DeveloperModeGate>;
}
