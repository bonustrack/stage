import { WalletSettings } from '../../components/settings/WalletSettings';
import { WalletGate } from '../../components/wallet/WalletGate';

export default function WalletSettingsRoute(): React.ReactElement | null {
  return (
    <WalletGate>
      <WalletSettings />
    </WalletGate>
  );
}
