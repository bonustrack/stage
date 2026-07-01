import { describe, test } from 'bun:test';
import { banner } from '../src/proposals/banner';
import { proposalCard } from '../src/proposals/proposalCard';
import { proposalHeaderRoot } from '../src/proposals/proposalHeader';
import { snap } from './helpers';

describe('banner', () => {
  test('minimal', () => {
    snap(banner({ label: 'New proposal' }));
  });

  test('full', () => {
    snap(
      banner({
        label: 'Signature required',
        icon: 'pencil',
        iconColor: 'danger',
        labelColor: { dark: '#ffffff', light: '#000000' },
        showChevron: false,
        pressType: 'custom.banner',
        payload: { id: 'sig-1' },
      }),
    );
  });
});

describe('proposalCard', () => {
  test('minimal', () => {
    snap(proposalCard({ eyebrow: 'poll', title: 'Treasury allocation' }));
  });

  test('full', () => {
    snap(
      proposalCard({
        eyebrow: 'poll',
        title: 'Treasury allocation',
        question: 'Fund the grants program?',
        authorName: 'alice.eth',
        authorAvatarUri: 'https://img.example/a.png',
        postedAt: 'Jun 4',
      }),
    );
  });
});

describe('proposalHeaderRoot', () => {
  test('poll', () => {
    snap(proposalHeaderRoot('poll', 'Treasury allocation'));
  });

  test('payment', () => {
    snap(proposalHeaderRoot('payment', 'Invoice #42'));
  });

  test('signing', () => {
    snap(proposalHeaderRoot('signing', 'Sign the manifest'));
  });

  test('message', () => {
    snap(proposalHeaderRoot('message', 'Broadcast update'));
  });
});
