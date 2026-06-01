/** Pieces of the Settings tab split out to keep SettingsScreen.tsx under the
 *  line cap: the theme-option list data + the floating-voice-pill section
 *  (overlay-permission grant + its return-to-foreground re-poll). Behaviour is
 *  identical to the inlined version. */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Col } from '../layout';
import {
  hasOverlayPermission, isPillAvailable, requestOverlayPermission,
} from '../../lib/pill';
import { flash } from '../../lib/toast';
import { type ThemePreference } from '../../lib/theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];

interface PillColors { fg: string; head: string; sub: string; border: string; rowBg: string }

/** Floating voice pill — now a PER-PERSON shortcut launched from a chat's
 *  "Float as pill" overflow item. Settings only owns the overlay-permission
 *  grant (the special SYSTEM_ALERT_WINDOW that the pill needs); the grant has
 *  no callback, so we re-poll on return-to-foreground. */
export function PillSection({ c }: { c: PillColors }): React.ReactElement | null {
  const pillSupported = isPillAvailable();
  const [overlayGranted, setOverlayGranted] = useState(false);

  useEffect(() => {
    if (pillSupported) setOverlayGranted(hasOverlayPermission());
  }, [pillSupported]);

  useEffect(() => {
    if (!pillSupported) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setOverlayGranted(hasOverlayPermission());
    });
    return () => subscription.remove();
  }, [pillSupported]);

  const grantOverlay = useCallback(() => {
    if (hasOverlayPermission()) { setOverlayGranted(true); return; }
    void requestOverlayPermission();
    flash('Allow “Display over other apps”, then return');
  }, []);

  if (!pillSupported) return null;

  return (
    <>
      <Text style={{ color: c.sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, fontFamily: 'Calibre-Medium' }}>
        FLOATING VOICE PILL
      </Text>
      <Pressable
        onPress={overlayGranted ? undefined : grantOverlay}
        style={{
          marginHorizontal: 16, borderRadius: 12, overflow: 'hidden',
          borderWidth: 1, borderColor: c.border, backgroundColor: c.rowBg,
          paddingHorizontal: 14, paddingVertical: 12,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}
      >
        <Icon name="microphone" size={22} color={c.head} />
        <Col flex={1}>
          <Text style={{ color: c.fg, fontSize: 16, fontFamily: 'Calibre-Medium' }}>Floating voice pill</Text>
          <Text style={{ color: c.sub, fontSize: 13, marginTop: 2, fontFamily: 'Calibre-Medium' }}>
            {overlayGranted
              ? 'Ready. Open a chat → ⋯ → “Float as pill” to launch it for that person.'
              : 'Grant “Display over other apps” to enable. Launch it per-person from a chat’s “Float as pill”.'}
          </Text>
        </Col>
        {overlayGranted
          ? <Icon name="check" size={20} color={c.head} />
          : <Text style={{ color: c.head, fontSize: 14, fontFamily: 'Calibre-Medium' }}>Grant</Text>}
      </Pressable>
    </>
  );
}
