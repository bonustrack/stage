import { useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { ChannelRow } from '../ChannelRow';
import { FormField } from '../FormField';
import type { ShareDestination } from './share.model';
import { useEffectiveColorScheme } from '../../lib/theme';
import { Column } from '../layout';

export function SharePicker({
  rows,
  loading,
  checking,
  error,
  account,
  onChoose,
  onRetry,
}: {
  rows: ShareDestination[];
  loading: boolean;
  checking: boolean;
  error: string | null;
  account: string;
  onChoose: (row: ShareDestination) => void;
  onRetry: () => void;
}): React.ReactElement {
  const [query, setQuery] = useState('');
  const dark = useEffectiveColorScheme() === 'dark';
  const listed = rows.filter((row) => row.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Column gap={12}>
      <Text size="sm" color="secondary">
        Choose an existing chat or channel. Nothing is sent yet.
      </Text>
      <Text size="xs" color="secondary">
        Account: {account}
      </Text>
      <FormField value={query} onChangeText={setQuery} placeholder="Search channels" disabled={checking} />
      {loading || checking ? <Spinner /> : null}
      {error === null ? null : (
        <Text size="sm" color="danger">
          {error}
        </Text>
      )}
      {checking
        ? null
        : listed.map((row) => (
            <ChannelRow
              key={row.convId}
              title={row.title}
              avatarAddress={row.peerAddress}
              avatarUri={row.avatarUri}
              square={row.peerAddress === null}
              showPreview={false}
              onPress={() => {
                onChoose(row);
              }}
            />
          ))}
      {!loading && !checking && listed.length === 0 ? <Text color="secondary">No accepted channels found.</Text> : null}
      <Button dark={dark} label="Refresh channels" variant="soft" color="secondary" disabled={loading || checking} onPress={onRetry} />
    </Column>
  );
}
