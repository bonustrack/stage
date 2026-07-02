import type { BasicNode, Color } from '@stage-labs/kit/kit';
import { basicRoot } from '../primitives';
import { screenHeader } from '../chrome/screenHeader';
import { profileHeader } from './profileHeader';
import { profileAddressRow } from './profileAddressRow';
import { profileActionsRow } from './profileActionsRow';

export function profileDisplayName(
  address: string,
  resolvedName: string | null | undefined,
  shortAddress: string,
): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}

export function profileNameNode(name: string): BasicNode {
  return basicRoot(profileHeader({ name }));
}

export interface ProfileAddressNodeParams {
  address: string;
  label: string;
  color: Color;
}

export function profileAddressNode(params: ProfileAddressNodeParams): BasicNode {
  return basicRoot(profileAddressRow(params));
}

export interface ProfileActionColors {
  border: Color;
  fg: Color;
}

export function profileMessageSendNode(
  colors: ProfileActionColors,
  opening: boolean,
): BasicNode {
  return basicRoot(
    profileActionsRow({
      border: colors.border,
      fg: colors.fg,
      actions: [
        {
          action: 'message',
          icon: 'chatRect',
          label: opening ? 'Opening…' : 'Message',
          disabled: opening,
        },
        { action: 'send', icon: 'send', label: 'Send' },
      ],
    }),
  );
}

export function profileOverlayHeaderNode(backColor: Color, safeTop?: number): BasicNode {
  return basicRoot(
    screenHeader({
      variant: 'overlay',
      backColor,
      backHitSlop: 10,
      backPadding: 6,
      safeTop,
    }),
  );
}
