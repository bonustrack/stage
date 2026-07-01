import { describe, expect, test } from 'bun:test';
import { channelRow } from '../src/chat/channelRow';
import { composerBar } from '../src/chat/composerBar';
import { composerInput } from '../src/chat/composerInput';
import { conversationHeader } from '../src/chat/conversationHeader';
import { emojiReactionRow } from '../src/chat/emojiReactionRow';
import { emptyState, sectionHeader } from '../src/chat/emptyState';
import { filterChips } from '../src/chat/filterChips';
import { highlightSegments, highlightText } from '../src/chat/highlightText';
import { labelBar } from '../src/chat/labelBar';
import { mediaCard } from '../src/chat/mediaCard';
import { menuSheet } from '../src/chat/menuSheet';
import { messageBubble } from '../src/chat/messageBubble';
import { overflowMenu } from '../src/chat/overflowMenu';
import { pollCard } from '../src/chat/pollCard';
import { previewLinkCard } from '../src/chat/previewLinkCard';
import { reactionsRow } from '../src/chat/reactionsRow';
import { videoMessage } from '../src/chat/videoMessage';
import { voiceMessage } from '../src/chat/voiceMessage';
import { snap } from './helpers';

describe('channelRow', () => {
  test('minimal', () => {
    snap(
      channelRow({
        convId: 'conv-1',
        avatarUri: 'https://img.example/a.png',
        title: 'General',
        preview: 'hello there',
        timestamp: '12:30',
      }),
    );
  });

  test('full', () => {
    snap(
      channelRow({
        convId: 'conv-1',
        avatarUri: 'https://img.example/a.png',
        title: 'General',
        preview: 'hello there',
        timestamp: 'Jun 4',
        unreadBadge: '3',
        titleSegments: [{ text: 'Gen' }, { text: 'eral', emphasized: true }],
        previewPrefix: 'You: ',
        chips: [{ label: 'work' }, { label: 'dao', color: 'info' }],
        pinned: true,
        unreadDot: true,
        omitAvatar: true,
        labelPressable: true,
        interactive: true,
      }),
    );
  });

  test('non-interactive with unread dot only', () => {
    const tree = channelRow({
      convId: 'conv-2',
      avatarUri: 'https://img.example/b.png',
      title: 'Quiet',
      preview: 'psst',
      timestamp: '09:01',
      unreadDot: true,
      chips: [{ label: 'muted' }],
      interactive: false,
    });
    expect(tree.type).toBe('Row');
    snap(tree);
  });
});

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

describe('reactionsRow', () => {
  test('minimal', () => {
    snap(reactionsRow({ reactions: [{ emoji: '👍', count: 2 }] }));
  });

  test('full', () => {
    snap(
      reactionsRow({
        messageId: 'msg-1',
        dispatchPress: true,
        pillBackground: '#111111',
        ownBorderColor: '#222222',
        reactions: [
          { emoji: '👍', count: 2, own: true },
          { emoji: '❤️', count: 1 },
        ],
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

describe('menuSheet', () => {
  test('minimal', () => {
    snap(menuSheet({ items: [{ id: 'copy', label: 'Copy' }] }));
  });

  test('full', () => {
    snap(
      menuSheet({
        items: [
          { id: 'reply', label: 'Reply', icon: 'reply' },
          { id: 'delete', label: 'Delete', icon: 'trash', danger: true, pressType: 'custom.item' },
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

describe('composerInput', () => {
  test('minimal', () => {
    snap(
      composerInput({
        value: 'draft',
        color: '#111111',
        placeholderColor: '#999999',
        fontSize: 16,
        selStart: 0,
        selEnd: 5,
        focusNonce: 1,
        blurNonce: 0,
      }),
    );
  });

  test('full', () => {
    snap(
      composerInput({
        value: 'draft',
        color: '#111111',
        placeholderColor: '#999999',
        fontSize: 16,
        selStart: 2,
        selEnd: 2,
        focusNonce: 3,
        blurNonce: 1,
        changeType: 'custom.change',
        selectionType: 'custom.selection',
      }),
    );
  });
});

describe('emptyState', () => {
  test('minimal', () => {
    snap(emptyState({ title: 'No messages' }));
  });

  test('full', () => {
    snap(
      emptyState({
        icon: 'inbox',
        title: 'No messages',
        caption: 'Start a conversation',
        actionLabel: 'New chat',
        actionId: 'new-chat',
      }),
    );
  });
});

describe('sectionHeader', () => {
  test('uppercases the title', () => {
    snap(sectionHeader({ title: 'today' }));
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

describe('labelBar', () => {
  test('minimal', () => {
    snap(
      labelBar({
        chips: [{ value: 'work', label: 'Work' }],
        selectedBackground: '#000000',
        selectedLabelColor: '#ffffff',
        restBackground: '#eeeeee',
        restLabelColor: '#333333',
      }),
    );
  });

  test('full', () => {
    snap(
      labelBar({
        chips: [
          { value: 'work', label: 'Work', selected: true },
          { value: 'dao', label: 'DAO' },
        ],
        selectedBackground: '#000000',
        selectedLabelColor: '#ffffff',
        restBackground: '#eeeeee',
        restLabelColor: '#333333',
        pressType: 'custom.label',
      }),
    );
  });
});
