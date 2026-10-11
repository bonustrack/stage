import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '../../components/chrome/EmptyState';
import { MailView } from '../../components/settings/MailView';

export default function MailRoute(): React.ReactElement {
  const { label, id } = useLocalSearchParams<{ label?: string; id?: string }>();
  if (!label || !id) return <EmptyState title="This mail is not available." />;
  return <MailView label={label} id={id} />;
}
