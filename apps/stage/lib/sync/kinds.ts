import type { AppSyncKind } from './kind';
import { READ_KIND } from './reads';
import { PIN_KIND } from './pins';
import { CLEAR_KIND } from './chatVisibility';
import { SETTING_KINDS } from './settings';

export const SYNC_APP_KINDS: readonly AppSyncKind[] = [READ_KIND, PIN_KIND, CLEAR_KIND, ...SETTING_KINDS];
