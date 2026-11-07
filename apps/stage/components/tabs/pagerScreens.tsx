import { BoardHome, HomeScreen } from '../home/HomeScreen';
import { ContactsTab } from '../contacts/ContactsScreen';
import { WalletScreen } from '../wallet/screen/WalletScreen';
import { SettingsMenu } from '../settings/SettingsHub';
import type { PagerPageId } from './pages';
import type { SimultaneousRefs } from '../layout/simultaneousRefs';

export const PAGER_SCREENS: Record<PagerPageId, (props: { panRef?: SimultaneousRefs }) => React.ReactElement | null> = {
  chats: HomeScreen,
  board: BoardHome,
  contacts: ContactsTab,
  wallet: WalletScreen,
  settings: SettingsMenu,
};
