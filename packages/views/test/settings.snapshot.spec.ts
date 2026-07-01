import { describe, expect, test } from 'bun:test';
import { settingsHeader } from '../src/settings/settingsHeader';
import {
  settingsButtonRow,
  settingsListRow,
  settingsNavRow,
  settingsRowSelectedIcon,
  settingsSection,
  settingsSectionTitle,
  settingsThemeRow,
  settingsToggleRow,
  settingsValueRow,
} from '../src/settings/settingsRows';
import {
  walletAccountNode,
  walletAddressNode,
  walletCopyRow,
  walletDeployRow,
  walletInfoRow,
  walletManageNode,
  walletModuleRow,
} from '../src/settings/walletSections';
import { snap } from './helpers';

describe('settingsSection', () => {
  test('minimal', () => {
    snap(settingsSection({ children: [{ type: 'Text', value: 'content' }] }));
  });

  test('full', () => {
    snap(
      settingsSection({
        title: 'Appearance',
        caption: 'Theme and display options',
        gap: 12,
        children: [{ type: 'Text', value: 'content' }],
      }),
    );
  });
});

describe('settingsNavRow', () => {
  test('minimal', () => {
    snap(settingsNavRow({ label: 'Notifications' }));
  });

  test('full', () => {
    snap(
      settingsNavRow({
        label: 'Notifications',
        value: 'On',
        iconStart: 'bell',
        iconEnd: 'arrow-right',
        pressType: 'custom.nav',
        payload: { screen: 'notifications' },
      }),
    );
  });
});

describe('settingsToggleRow', () => {
  test('minimal (checkbox)', () => {
    snap(settingsToggleRow({ label: 'Read receipts', name: 'readReceipts', checked: false }));
  });

  test('full (switch)', () => {
    snap(
      settingsToggleRow({
        label: 'Read receipts',
        name: 'readReceipts',
        checked: true,
        description: 'Let others see when you read messages',
        changeType: 'custom.toggle',
        control: 'switch',
      }),
    );
  });
});

describe('settingsValueRow', () => {
  test('minimal', () => {
    snap(settingsValueRow({ label: 'Version', value: '1.2.3' }));
  });

  test('full', () => {
    snap(
      settingsValueRow({
        label: 'Inbox ID',
        value: 'inbox-123',
        copyType: 'custom.copy',
        payload: { kind: 'inbox' },
      }),
    );
  });
});

describe('settingsButtonRow', () => {
  test('minimal', () => {
    snap(settingsButtonRow({ label: 'Export logs', clickType: 'settings.button.press' }));
  });

  test('full (danger)', () => {
    snap(
      settingsButtonRow({
        label: 'Delete account',
        description: 'This cannot be undone',
        iconStart: 'trash',
        clickType: 'settings.button.press',
        payload: { id: 'delete' },
        danger: true,
      }),
    );
  });
});

describe('settingsThemeRow', () => {
  test('minimal (unselected)', () => {
    snap(settingsThemeRow({ value: 'light', label: 'Light', iconName: 'sun', selected: false }));
  });

  test('full (selected with icon color)', () => {
    snap(
      settingsThemeRow({
        value: 'dark',
        label: 'Dark',
        iconName: 'moon',
        selected: true,
        iconColor: '#8888ff',
      }),
    );
  });
});

describe('settingsSectionTitle', () => {
  test('renders a lg title', () => {
    snap(settingsSectionTitle('Appearance'));
  });
});

describe('settingsListRow', () => {
  test('wraps an item in a ListView', () => {
    const item = settingsNavRow({ label: 'About' });
    const tree = settingsListRow(item);
    expect(tree).toEqual({ type: 'ListView', children: [item] });
    snap(tree);
  });
});

describe('settingsRowSelectedIcon', () => {
  test('returns undefined when unselected', () => {
    expect(settingsRowSelectedIcon(false)).toBeUndefined();
  });

  test('returns a check icon when selected', () => {
    snap(settingsRowSelectedIcon(true));
  });
});

describe('settingsHeader', () => {
  test('minimal', () => {
    snap(settingsHeader({ title: 'Settings', backColor: '#111111' }));
  });

  test('full', () => {
    snap(
      settingsHeader({
        title: 'Settings',
        backColor: '#111111',
        titleColor: '#000000',
        surface: '#ffffff',
        borderColor: '#eeeeee',
        safeTop: 44,
      }),
    );
  });
});

describe('walletInfoRow', () => {
  test('label and value', () => {
    snap(walletInfoRow('Name', 'Main'));
  });
});

describe('walletCopyRow', () => {
  test('label and value with copy action', () => {
    snap(walletCopyRow('Address', '0xabc0000000000000000000000000000000000001'));
  });
});

describe('walletModuleRow', () => {
  test('sudo role', () => {
    snap(walletModuleRow('Passkey signer', 'sudo', 'Active'));
  });

  test('recovery role', () => {
    snap(walletModuleRow('Guardian module', 'recovery', 'Installed'));
  });
});

describe('walletDeployRow', () => {
  test('deployed', () => {
    snap(walletDeployRow('deployed'));
  });

  test('loading', () => {
    snap(walletDeployRow('loading'));
  });

  test('counterfactual', () => {
    snap(walletDeployRow('counterfactual'));
  });

  test('unknown', () => {
    snap(walletDeployRow('unknown'));
  });
});

describe('walletManageNode', () => {
  test('minimal (recovery row only)', () => {
    snap(
      walletManageNode(
        { available: false, busy: false },
        { available: false, busy: false },
        undefined,
      ),
    );
  });

  test('full (busy passkey, removable, guardians set)', () => {
    snap(
      walletManageNode(
        { available: true, busy: true },
        { available: true, busy: false },
        2,
      ),
    );
  });
});

describe('walletAccountNode', () => {
  test('legacy account', () => {
    snap(
      walletAccountNode({
        label: 'Main',
        hdIndex: null,
        isSmart: false,
        rec: { type: 'seed' },
        activeSigner: '',
      }),
    );
  });

  test('smart account with hd index and signer', () => {
    snap(
      walletAccountNode({
        label: 'Main',
        hdIndex: 0,
        isSmart: true,
        rec: { type: 'seed' },
        activeSigner: 'passkey',
      }),
    );
  });
});

describe('walletAddressNode', () => {
  test('wraps the address copy row', () => {
    snap(walletAddressNode({ address: '0xabc0000000000000000000000000000000000001' }));
  });
});
