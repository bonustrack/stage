import { Row } from '../layout';
import { Button } from '@stage-labs/kit/react-native/button';
import { useSafeAreaInsets } from '../../lib/safeArea';

export function WalletFooter({
  border, dark, onCancel, cancelLabel = 'Cancel', submitLabel, onSubmit, submitDisabled, submitLoading,
}: {
  border: string; dark: boolean;
  onCancel: () => void; cancelLabel?: string;
  submitLabel: string; onSubmit: () => void;
  submitDisabled?: boolean; submitLoading?: boolean;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="surface" padding={{ x: 16, top: 12, bottom: Math.max(insets.bottom, 12) }} gap={12}
      style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Button color="secondary" variant="solid" size="lg" pill dark={dark} style={{ flex: 1 }}
        onPress={onCancel} label={cancelLabel}/>
      <Button size="lg" pill dark={dark} style={{ flex: 1 }}
        loading={!!submitLoading} disabled={!!submitDisabled}
        onPress={onSubmit} label={submitLabel}/>
    </Row>
  );
}
