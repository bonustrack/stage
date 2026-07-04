import { describe, expect, test } from 'bun:test';
import { composerBar } from '../views/chat/composerBar';
import { conversationHeader } from '../views/chat/conversationHeader';
import { emojiReactionRow } from '../views/chat/emojiReactionRow';
import { filterChips } from '../views/chat/filterChips';
import { highlightSegments, highlightText } from '../views/chat/highlightText';
import { mediaCard } from '../views/chat/mediaCard';
import { messageBubble } from '../views/chat/messageBubble';
import { overflowMenu } from '../views/chat/overflowMenu';
import { pollCard } from '../views/chat/pollCard';
import { previewLinkCard } from '../views/chat/previewLinkCard';
import { videoMessage } from '../views/chat/videoMessage';
import { voiceMessage } from '../views/chat/voiceMessage';
import { snap } from './helpers';

describe('mediaCard', () => {
  test('minimal (plain box, no action)', () => {
    const tree = mediaCard({ children: [{ type: 'Image', src: 'https://img.example/m.png' }] });
    expect(tree.type).toBe('Box');
    snap(tree);
  });

  test('with mediaId derives the press action', () => {
    snap(mediaCard({ mediaId: 'm1', children: [{ type: 'Image', src: 'https://img.example/m.png' }] }));
  });

  test('full with explicit clickAction and width', () => {
    snap(
      mediaCard({
        mediaId: 'm1',
        width: 320,
        clickAction: { type: 'custom.press', payload: { k: 'v' } },
        children: [{ type: 'Image', src: 'https://img.example/m.png' }],
      }),
    );
  });
});

describe('emojiReactionRow', () => {
  test('minimal', () => {
    snap(emojiReactionRow({ emojis: ['👍', '❤️'] }));
  });

  test('full', () => {
    snap(emojiReactionRow({ emojis: ['🔥'], pressType: 'custom.emoji' }));
  });
});

describe('highlightSegments', () => {
  test('empty query yields one non-match segment', () => {
    expect(highlightSegments('Hello', '')).toEqual([{ value: 'Hello', match: false }]);
  });

  test('case-insensitive matching splits around matches', () => {
    expect(highlightSegments('Hello hello world', 'hello')).toEqual([
      { value: 'Hello', match: true },
      { value: ' ', match: false },
      { value: 'hello', match: true },
      { value: ' world', match: false },
    ]);
  });
});

describe('highlightText', () => {
  test('minimal', () => {
    snap(highlightText({ text: 'plain text', query: '' }));
  });

  test('full', () => {
    snap(
      highlightText({
        text: 'find the Needle here',
        query: 'needle',
        color: 'secondary',
        matchBackground: '#fff200',
        size: 'sm',
        fontSize: 14,
        lineHeight: 18,
      }),
    );
  });
});

describe('previewLinkCard', () => {
  test('minimal', () => {
    snap(previewLinkCard({ url: 'https://example.com', title: 'Example' }));
  });

  test('full', () => {
    snap(
      previewLinkCard({
        url: 'https://example.com',
        title: 'Example',
        subtitle: 'An example site',
        imageUri: 'https://img.example/preview.png',
      }),
    );
  });
});

describe('conversationHeader', () => {
  test('minimal', () => {
    snap(conversationHeader({ title: 'Alice' }));
  });

  test('full', () => {
    snap(
      conversationHeader({
        conversationId: 'conv-1',
        avatarUri: 'https://img.example/a.png',
        avatarSquare: true,
        title: 'DAO Ops',
      }),
    );
  });
});

describe('pollCard', () => {
  test('minimal', () => {
    snap(
      pollCard({
        questions: [
          {
            question: 'Ship it?',
            options: [
              { label: 'Yes', votes: 3, pct: 75 },
              { label: 'No', votes: 1, pct: 25 },
            ],
            total: 4,
          },
        ],
      }),
    );
  });

  test('full', () => {
    snap(
      pollCard({
        fillBackground: '#e0e0ff',
        selectedBackground: '#d0ffd0',
        selectedBorderColor: '#00aa00',
        borderColor: '#cccccc',
        dispatchPress: true,
        questions: [
          {
            question: 'Pick toppings',
            header: 'Lunch poll',
            multiSelect: true,
            options: [
              { label: 'Cheese', votes: 1, pct: 100, selected: true },
              { label: 'Olives', votes: 0, pct: 0 },
            ],
            total: 1,
          },
        ],
      }),
    );
  });
});

describe('overflowMenu', () => {
  test('minimal', () => {
    snap(overflowMenu({ items: [{ id: 'a', label: 'A' }] }));
  });

  test('full', () => {
    snap(
      overflowMenu({
        items: [
          { id: 'edit', label: 'Edit', icon: 'pencil' },
          { id: 'remove', label: 'Remove', icon: 'trash', danger: true, disabled: true },
        ],
        icon: 'menu',
        iconSize: 18,
        align: 'start',
        title: 'Options',
        pressType: 'custom.overflow',
      }),
    );
  });
});

describe('composerBar', () => {
  test('minimal', () => {
    snap(composerBar({}));
  });

  test('full', () => {
    snap(
      composerBar({
        fieldName: 'reply',
        placeholder: 'Reply…',
        value: 'hello',
        sendIcon: 'paper-plane',
        sendDisabled: true,
        showSend: true,
        attachIcon: 'paperclip',
      }),
    );
  });

  test('hides send button when showSend is false', () => {
    snap(composerBar({ showSend: false }));
  });
});

describe('messageBubble', () => {
  test('minimal', () => {
    snap(messageBubble({ align: 'start', text: 'hi' }));
  });

  test('full with markdown body', () => {
    snap(
      messageBubble({
        align: 'end',
        markdown: '**bold** move',
        status: 'sent',
        timestamp: '12:30',
        authorName: 'Alice',
        textColor: '#111111',
        metaColor: '#666666',
      }),
    );
  });

  test('segments body with emphasis', () => {
    snap(
      messageBubble({
        align: 'start',
        segments: [{ text: 'plain ' }, { text: 'match', emphasized: true }],
        timestamp: '08:00',
        textColor: '#222222',
      }),
    );
  });
});

describe('voiceMessage', () => {
  test('minimal', () => {
    snap(voiceMessage({ src: 'https://media.example/v.mp3' }));
  });

  test('full', () => {
    snap(
      voiceMessage({
        src: 'https://media.example/v.mp3',
        duration: 12,
        background: '#123456',
        onAccent: '#ffffff',
        bars: [1, 4, 2],
        barCount: 3,
      }),
    );
  });
});

describe('videoMessage', () => {
  test('minimal', () => {
    snap(videoMessage({ src: 'https://media.example/v.mp4' }));
  });

  test('full', () => {
    snap(
      videoMessage({
        src: 'https://media.example/v.mp4',
        poster: 'https://img.example/poster.png',
        width: 300,
      }),
    );
  });
});

describe('filterChips', () => {
  test('minimal', () => {
    snap(
      filterChips({
        chips: [{ value: 'all', label: 'All' }],
        selectedBackground: '#000000',
        selectedLabelColor: '#ffffff',
        restBackground: '#eeeeee',
        restLabelColor: '#333333',
      }),
    );
  });

  test('full', () => {
    snap(
      filterChips({
        chips: [
          { value: 'all', label: 'All', selected: true },
          { value: 'unread', label: 'Unread' },
        ],
        selectedBackground: '#000000',
        selectedLabelColor: '#ffffff',
        restBackground: '#eeeeee',
        restLabelColor: '#333333',
        selectType: 'custom.filter',
      }),
    );
  });
});

