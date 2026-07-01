import { describe, expect, test } from 'bun:test';
import { addressCard, addressCopyRow, addressShareAction } from '../src/wallet/addressCard';
import { balanceHeader } from '../src/wallet/balanceHeader';
import { nftGrid } from '../src/wallet/nftGrid';
import { noticeCard } from '../src/wallet/noticeCard';
import { priceChart } from '../src/wallet/priceChart';
import { receiveView } from '../src/wallet/receiveView';
import { sendFields } from '../src/wallet/sendFields';
import { sendForm, sendReviewList } from '../src/wallet/sendForm';
import { stepper } from '../src/wallet/stepper';
import { tokenDetailCard } from '../src/wallet/tokenDetailCard';
import { tokenRow, tokenRowBody } from '../src/wallet/tokenRow';
import { walletActions } from '../src/wallet/walletActions';
import { walletTabs } from '../src/wallet/walletTabs';
import { snap } from './helpers';

const TOKEN_BASE = {
  tokenId: 'eth-mainnet',
  symbol: 'ETH',
  name: 'Ethereum',
  priceUsd: '$3,000.00',
  balance: '1.2345',
  change24h: '+2.4%',
  logoUri: 'https://img.example/eth.png',
};

describe('tokenRow', () => {
  test('minimal', () => {
    snap(tokenRow(TOKEN_BASE));
  });

  test('full with chain badge, private and negative change', () => {
    snap(
      tokenRow({
        ...TOKEN_BASE,
        change24h: '-1.2%',
        chainBadgeUri: 'https://img.example/base.png',
        isPrivate: true,
        showAvatar: true,
        trailingChevron: true,
      }),
    );
  });

  test('no avatar and no chevron', () => {
    snap(tokenRow({ ...TOKEN_BASE, showAvatar: false, trailingChevron: false }));
  });
});

describe('tokenRowBody', () => {
  test('returns the inner row of tokenRow', () => {
    const body = tokenRowBody(TOKEN_BASE);
    expect(body.type).toBe('Row');
    snap(body);
  });
});

describe('addressCopyRow', () => {
  test('minimal', () => {
    snap(addressCopyRow({ label: 'Address', address: '0xabc0000000000000000000000000000000000001' }));
  });

  test('empty address renders a dash', () => {
    snap(addressCopyRow({ label: 'Address', address: '' }));
  });
});

describe('addressCard', () => {
  test('minimal', () => {
    snap(addressCard({ label: 'Public address', address: '0xabc0000000000000000000000000000000000001' }));
  });

  test('full', () => {
    snap(
      addressCard({
        label: 'Public address',
        address: '0xabc0000000000000000000000000000000000001',
        hint: 'Only send assets on Base',
        copyType: 'custom.copy',
        shareType: 'custom.share',
        copyPayload: { kind: 'public' },
        sharePayload: { kind: 'public' },
      }),
    );
  });
});

describe('addressShareAction', () => {
  test('minimal uses the default share type', () => {
    snap(addressShareAction({ label: 'Address', address: '0xabc' }));
  });

  test('full uses the override and merges the payload', () => {
    snap(
      addressShareAction({
        label: 'Address',
        address: '0xabc',
        shareType: 'custom.share',
        sharePayload: { kind: 'private' },
      }),
    );
  });
});

describe('receiveView', () => {
  test('with address renders a QR code', () => {
    snap(
      receiveView({
        address: '0xabc0000000000000000000000000000000000001',
        label: 'Public address',
        hint: 'Scan to send',
        borderColor: '#dddddd',
      }),
    );
  });

  test('without address renders a placeholder box', () => {
    snap(receiveView({ address: '', label: 'Public address', hint: 'Loading…', borderColor: '#dddddd' }));
  });
});

describe('tokenDetailCard', () => {
  const base = {
    logoSrc: 'https://img.example/eth.png',
    networkLogo: 'https://img.example/base.png',
    networkLabel: 'Base',
    name: 'Ethereum',
    balanceLabel: '1.2345 ETH',
    usdLabel: '$3,703.50',
    borderColor: '#dddddd',
    bgColor: '#ffffff',
    actionsPadTop: 12,
  };

  test('minimal', () => {
    snap(tokenDetailCard({ ...base, actions: [] }));
  });

  test('full', () => {
    snap(
      tokenDetailCard({
        ...base,
        actions: [
          { label: 'Send', icon: 'arrow-up', pressType: 'wallet.action.press', bg: '#f0f0f0', payload: { action: 'send' } },
        ],
        isPrivate: true,
        privateIconColor: '#888888',
        nameRowMarginTop: 8,
        balanceMarginTop: 4,
      }),
    );
  });
});

describe('balanceHeader', () => {
  test('minimal', () => {
    snap(balanceHeader({ total: '$1,234' }));
  });

  test('full', () => {
    snap(
      balanceHeader({
        total: '$1,234',
        totalDecimals: '.56',
        subtitle: 'Across 3 accounts',
        heroSize: '6xl',
        actions: [
          { label: 'Send', icon: 'arrow-up', pressType: 'wallet.action.press', bg: '#f0f0f0', payload: { action: 'send' } },
          { label: 'Receive', icon: 'arrow-down', pressType: 'wallet.action.press', bg: '#f0f0f0' },
        ],
      }),
    );
  });
});

describe('stepper', () => {
  test('minimal', () => {
    snap(stepper({ steps: [{ label: 'Prepare', state: 'pending' }] }));
  });

  test('full with every state and hints', () => {
    snap(
      stepper({
        gap: 8,
        steps: [
          { label: 'Prepare', state: 'done' },
          { label: 'Prove', state: 'active', hint: 'Generating proof' },
          { label: 'Broadcast', state: 'pending' },
          { label: 'Confirm', state: 'error', hint: 'Transaction reverted' },
        ],
      }),
    );
  });
});

describe('priceChart', () => {
  test('minimal', () => {
    snap(priceChart({ points: [{ t: 1, price: 10 }, { t: 2, price: 12 }] }));
  });

  test('full', () => {
    snap(
      priceChart({
        points: [{ t: '2024-01-01', price: 10 }, { t: '2024-01-02', price: 9 }],
        color: '#00aa00',
        height: 120,
        area: true,
      }),
    );
  });
});

describe('sendReviewList', () => {
  test('empty', () => {
    snap(sendReviewList([]));
  });

  test('with rows', () => {
    snap(sendReviewList([{ label: 'To', value: '0xabc' }, { label: 'Network fee', value: '0.0001 ETH' }]));
  });
});

describe('sendForm', () => {
  test('minimal', () => {
    snap(sendForm({ recipientName: 'to', amountName: 'amount', submitLabel: 'Send' }));
  });

  test('full', () => {
    snap(
      sendForm({
        recipientName: 'to',
        recipientValue: 'vitalik.eth',
        recipientPlaceholder: 'Recipient',
        amountName: 'amount',
        amountValue: '0.5',
        amountPlaceholder: '0.00',
        tokenName: 'token',
        tokenOptions: [{ label: 'ETH', value: 'eth' }, { label: 'USDC', value: 'usdc' }],
        tokenValue: 'eth',
        reviewRows: [{ label: 'Fee', value: '0.0001 ETH' }],
        submitLabel: 'Review',
        submitType: 'custom.submit',
        submitDisabled: true,
      }),
    );
  });
});

describe('sendFields', () => {
  test('minimal', () => {
    snap(sendFields({ recipient: '', amount: '', unitLabel: 'ETH' }));
  });

  test('full', () => {
    snap(
      sendFields({
        recipient: 'vitalik.eth',
        recipientPlaceholder: 'Recipient',
        resolving: true,
        resolvedText: '0xd8dA…6045',
        recipientError: 'Not found',
        amount: '0.5',
        unitLabel: 'ETH',
        secondaryLabel: '≈ $1,500',
        amountError: 'Insufficient balance',
        balanceLabel: 'Balance: 0.1 ETH',
        maxDisabled: true,
        fieldChangeType: 'custom.change',
        fieldActionType: 'custom.action',
      }),
    );
  });
});

describe('walletActions', () => {
  test('minimal', () => {
    snap(
      walletActions({
        actions: [{ label: 'Send', icon: 'arrow-up', pressType: 'wallet.action.press', bg: '#f0f0f0' }],
      }),
    );
  });

  test('full', () => {
    snap(
      walletActions({
        gap: 36,
        actions: [
          { label: 'Send', icon: 'arrow-up', pressType: 'wallet.action.press', bg: '#f0f0f0', payload: { action: 'send' } },
          { label: 'Shield', icon: 'shield', pressType: 'wallet.action.press', bg: { dark: '#222222', light: '#eeeeee' } },
        ],
      }),
    );
  });
});

describe('walletTabs', () => {
  test('minimal', () => {
    snap(walletTabs({ value: 'tokens', options: [{ label: 'Tokens', value: 'tokens' }] }));
  });

  test('full', () => {
    snap(
      walletTabs({
        value: 'nfts',
        options: [
          { label: 'Tokens', value: 'tokens' },
          { label: 'NFTs', value: 'nfts' },
        ],
        changeType: 'custom.tab',
      }),
    );
  });
});

describe('nftGrid', () => {
  test('minimal (placeholder tile)', () => {
    snap(nftGrid({ items: [{ title: 'Punk' }], cardBg: '#eeeeee' }));
  });

  test('full', () => {
    snap(
      nftGrid({
        items: [
          {
            title: 'Punk',
            collection: 'CryptoPunks',
            image: 'https://img.example/punk.png',
            url: 'https://opensea.example/punk',
          },
          { title: 'Blank' },
        ],
        cardBg: '#eeeeee',
        openType: 'custom.open',
      }),
    );
  });
});

describe('noticeCard', () => {
  test('minimal', () => {
    snap(noticeCard({ title: 'Heads up' }));
  });

  test('full', () => {
    snap(
      noticeCard({
        icon: 'exclamation',
        iconColor: { dark: '#ffcc00', light: '#aa8800' },
        title: 'Backup required',
        titleColor: 'danger',
        description: 'Save your recovery phrase before continuing.',
        gap: 16,
        actions: [
          { label: 'Backup now', pressType: 'wallet.notice.press', variant: 'solid', payload: { id: 'backup' } },
          { label: 'Later', pressType: 'wallet.notice.press', variant: 'ghost' },
        ],
      }),
    );
  });
});
