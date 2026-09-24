import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/dropdown-menu';
import { TOOLTIP as KIT_TOOLTIP } from '@stage-labs/kit/react-native/tooltip';
import { OVERLAY_SHADOW } from '@stage-labs/kit/overlay.styles';

export const MENU_GAP = 8;
export const MENU_ROW = { padX: DROPDOWN_MENU.itemPadX, padY: DROPDOWN_MENU.itemPadY } as const;
export const MENU_SHADOW = OVERLAY_SHADOW;
export const TOOLTIP = { arrow: KIT_TOOLTIP.arrow, offset: 14, layer: 60 } as const;
