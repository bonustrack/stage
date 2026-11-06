import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconCamera1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCamera1';
import { IconChart3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChart3';
import { IconImages1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconImages1';
import { IconMapPin } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMapPin';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { IconPaperclip3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperclip3';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import type { AttachmentId } from '../../lib/drafts';
import { offeredAttachKinds, type AttachOptions } from './attachActions.model';

const ATTACH_ICONS: Record<AttachmentId, CentralIcon> = {
  voice: IconMicrophone,
  image: IconImages1,
  camera: IconCamera1,
  file: IconPaperclip3,
  location: IconMapPin,
  poll: IconChart3,
  sign: IconPencil,
  payment: IconWallet4,
};

export interface AttachAction {
  id: AttachmentId;
  icon: CentralIcon;
  label: string;
  run: () => void | Promise<void>;
}

export type AttachRunners = Record<AttachmentId, () => void | Promise<void>>;

export function attachActionsOf(run: AttachRunners, options: AttachOptions): AttachAction[] {
  return offeredAttachKinds(options).map(({ id, label }) => ({ id, icon: ATTACH_ICONS[id], label, run: run[id] }));
}
