import type { MenuItem } from '../appIcons';

export const COPY_ADDRESS_ITEM: MenuItem<'copy-address'> = { id: 'copy-address', label: 'Copy address', icon: 'IconSquareBehindSquare1' };

export type PeerAction = 'message' | 'send';

export type PeerProfileId = PeerAction | 'copy-address';

export const PEER_PROFILE_ACTIONS: MenuItem<PeerAction>[] = [
  { id: 'message', label: 'Message', icon: 'IconBubbleAnnotation3' },
  { id: 'send', label: 'Send', icon: 'IconPaperPlane' },
];

export const PEER_PROFILE_MENU: MenuItem<PeerProfileId>[] = [...PEER_PROFILE_ACTIONS, COPY_ADDRESS_ITEM];
