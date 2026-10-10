import { Badge } from '@stage-labs/kit/react-native/badge';

export function CountTag({ count }: { count: number }): React.ReactElement {
  return <Badge label={String(count)} color="secondary" variant="soft"/>;
}
