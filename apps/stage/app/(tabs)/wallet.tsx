import TabRoutePlaceholder from './index';
import { WalletGate } from '../../components/wallet/WalletGate';

export default function WalletTabRoute(): React.ReactElement | null {
  return (
    <WalletGate>
      <TabRoutePlaceholder />
    </WalletGate>
  );
}
