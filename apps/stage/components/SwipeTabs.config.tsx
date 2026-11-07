import { BoardHome, HomeScreen } from './home/HomeScreen';
import { ContactsTab } from './ContactsScreen';
import { WalletScreen } from './wallet/screen/WalletScreen';
import { SettingsMenu } from './settings/SettingsHub';
import type { TabName } from './SwipeTabs.model';
import type { SimultaneousRefs } from './SwipeTabs.types';

export const PAGES: Record<TabName, (props: { panRef?: SimultaneousRefs }) => React.ReactElement | null> = {
  index: HomeScreen,
  board: BoardHome,
  contacts: ContactsTab,
  wallet: WalletScreen,
  settings: SettingsMenu,
};
