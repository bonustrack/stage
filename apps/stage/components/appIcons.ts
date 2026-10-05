import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';
import { IconArrowUndoUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUndoUp';
import { IconBell } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBell';
import { IconBubble3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubble3';
import { IconBubbleAnnotation3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubbleAnnotation3';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconCircleDashed } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleDashed';
import { IconCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCode';
import { IconColumns3Wide } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconColumns3Wide';
import { IconDevices } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDevices';
import { IconEmail1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconEmail1';
import { IconEyeOpen } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconEyeOpen';
import { IconFileBend } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileBend';
import { IconFolder1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFolder1';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconImac } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconImac';
import { IconKey2 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconKey2';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { IconMoon } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMoon';
import { IconPaperPlane } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperPlane';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconPeopleAdded } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleAdded';
import { IconPeopleCircle } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleCircle';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { IconQuestionmarkCircle } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQuestionmarkCircle';
import { IconSettingsGear2 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSettingsGear2';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { IconSun } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSun';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { IconTeam } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTeam';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import { IconThumbtack } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconThumbtack';

export const APP_ICONS = {
  IconArrowLeft,
  IconArrowUndoUp,
  IconBell,
  IconBubble3,
  IconBubbleAnnotation3,
  IconCheckmark1,
  IconCircleDashed,
  IconCode,
  IconColumns3Wide,
  IconDevices,
  IconEmail1,
  IconEyeOpen,
  IconFileBend,
  IconFolder1,
  IconGroup1,
  IconImac,
  IconKey2,
  IconMagnifyingGlass,
  IconMoon,
  IconPaperPlane,
  IconPencil,
  IconPeople,
  IconPeopleAdded,
  IconPeopleCircle,
  IconPlusLarge,
  IconQuestionmarkCircle,
  IconSettingsGear2,
  IconSquareBehindSquare1,
  IconSun,
  IconTag,
  IconTeam,
  IconThumbtack,
  IconTrashCan,
  IconWallet4,
};

export type AppIconName = keyof typeof APP_ICONS;

export interface MenuItem<Id extends string = string, Icon = AppIconName> {
  id: Id; label: string; icon: Icon; danger?: boolean; selected?: boolean;
}
