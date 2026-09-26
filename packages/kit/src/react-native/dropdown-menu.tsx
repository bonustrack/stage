import { centralIcon, type IconName } from '../central-icons';
import { DropdownMenuItem as MenuItem, type DropdownMenuItemProps as MenuItemProps } from './menu';

export { DROPDOWN_MENU, DropdownMenu, DropdownMenuSeparator, type DropdownMenuProps } from './menu';

export interface DropdownMenuItemProps extends Omit<MenuItemProps, 'iconName'> {
  iconName?: IconName;
}

export function DropdownMenuItem({ iconName, ...props }: DropdownMenuItemProps): React.ReactElement {
  return <MenuItem {...props} iconName={iconName === undefined ? undefined : centralIcon(iconName)} />;
}
