/**
 * Pure-function tests for the per-station `text` placeholder synthesizers.
 * Station classes themselves talk to discord.js / the Bot API and need a real
 * network or mock client; the synth helpers are the testable seam.
 */

import { describe, expect, test } from 'bun:test';
import { synthDiscordText } from '../src/stations/discord-synth.ts';
import { synthTelegramText } from '../src/stations/telegram-synth.ts';
import type { TelegramPayload } from '../src/stations/telegram-types.ts';

/**
 * Discord. The synth function takes a discord.js Message, but only reads
 * the public fields we care about. A minimal fixture lets us pin every
 * placeholder shape without booting a Client.
 */
type FakeAttachment = { name: string | null; contentType: string | null };
type FakeSticker = { name: string };
type FakeCollection<T> = { values(): Iterable<T>; size: number };

interface FakeMessage {
  content: string;
  stickers: FakeCollection<FakeSticker>;
  attachments: FakeCollection<FakeAttachment>;
  embeds: unknown[];
  poll: unknown;
  messageSnapshots: FakeCollection<unknown>;
}

const coll = <T>(items: T[]): FakeCollection<T> => ({
  values: () => items[Symbol.iterator](),
  size: items.length,
});

function fakeMessage(over: Partial<FakeMessage> = {}): FakeMessage {
  return {
    content: '', stickers: coll<FakeSticker>([]), attachments: coll<FakeAttachment>([]),
    embeds: [], poll: null, messageSnapshots: coll<unknown>([]),
    ...over,
  };
}

describe('synthDiscordText', () => {
  test('passes through bare content', () => {
    expect(synthDiscordText(fakeMessage({ content: 'hello world' }) as never)).toBe('hello world');
  });

  test('sticker-only -> "[sticker: <name>]"', () => {
    const m = fakeMessage({ stickers: coll([{ name: 'pepe-wave' }]) });
    expect(synthDiscordText(m as never)).toBe('[sticker: pepe-wave]');
  });

  test('poll-only -> "[poll]"', () => {
    const m = fakeMessage({ poll: { question: { text: 'pizza?' } } });
    expect(synthDiscordText(m as never)).toBe('[poll]');
  });

  test('forwarded message -> "[forwarded]"', () => {
    const m = fakeMessage({ messageSnapshots: coll([{ id: '123' }]) });
    expect(synthDiscordText(m as never)).toBe('[forwarded]');
  });

  test('image attachment -> "[image]"', () => {
    const m = fakeMessage({
      attachments: coll([{ name: 'photo.jpg', contentType: 'image/jpeg' }]),
    });
    expect(synthDiscordText(m as never)).toBe('[image]');
  });

  test('audio attachment -> "[audio: <name>]"', () => {
    const m = fakeMessage({
      attachments: coll([{ name: 'voice.ogg', contentType: 'audio/ogg' }]),
    });
    expect(synthDiscordText(m as never)).toBe('[audio: voice.ogg]');
  });

  test('content + sticker -> both', () => {
    const m = fakeMessage({ content: 'lol', stickers: coll([{ name: 'kek' }]) });
    expect(synthDiscordText(m as never)).toBe('lol [sticker: kek]');
  });

  test('embed-only (link unfurl) -> "[embed]"', () => {
    const m = fakeMessage({ embeds: [{ url: 'https://x' }] });
    expect(synthDiscordText(m as never)).toBe('[embed]');
  });
});

const tgChat = { id: 1, type: 'private' as const };
const tgFrom = { id: 2, is_bot: false, username: 'alice' };
const tgBase = (over: Partial<TelegramPayload>): TelegramPayload => ({
  message_id: 1, chat: tgChat, from: tgFrom, ...over,
});

describe('synthTelegramText', () => {
  test('plain text passes through', () => {
    expect(synthTelegramText(tgBase({ text: 'hello' }))).toBe('hello');
  });

  test('caption passes through', () => {
    expect(synthTelegramText(tgBase({ caption: 'cap' }))).toBe('cap');
  });

  test('sticker -> "[sticker: <set>/<emoji>]"', () => {
    const p = tgBase({ sticker: { file_id: 'f', set_name: 'PepeSet', emoji: '😀' } });
    expect(synthTelegramText(p)).toBe('[sticker: PepeSet/😀]');
  });

  test('sticker without set falls back to emoji only', () => {
    const p = tgBase({ sticker: { file_id: 'f', emoji: '🙂' } });
    expect(synthTelegramText(p)).toBe('[sticker: 🙂]');
  });

  test('voice -> "[voice]"', () => {
    expect(synthTelegramText(tgBase({ voice: { file_id: 'f' } }))).toBe('[voice]');
  });

  test('animation -> "[animation]"', () => {
    expect(synthTelegramText(tgBase({ animation: { file_id: 'f' } }))).toBe('[animation]');
  });

  test('dice -> "[dice: <emoji>=<value>]"', () => {
    const p = tgBase({ dice: { emoji: '🎯', value: 5 } });
    expect(synthTelegramText(p)).toBe('[dice: 🎯=5]');
  });

  test('poll -> "[poll]"', () => {
    expect(synthTelegramText(tgBase({ poll: { question: 'q' } }))).toBe('[poll]');
  });

  test('contact -> "[contact]"', () => {
    expect(synthTelegramText(tgBase({ contact: { phone_number: '1' } }))).toBe('[contact]');
  });

  test('photo + caption combines', () => {
    const p = tgBase({ caption: 'lol', photo: [{ file_id: 'f' }] });
    expect(synthTelegramText(p)).toBe('lol [image]');
  });

  test('video -> "[video]"', () => {
    expect(synthTelegramText(tgBase({ video: { file_id: 'f' } }))).toBe('[video]');
  });

  test('forwarded message -> "[forwarded]"', () => {
    const p = tgBase({ text: 'fwd', forward_origin: { type: 'user' } });
    expect(synthTelegramText(p)).toBe('fwd [forwarded]');
  });

  test('joined member service message -> "[member_joined]"', () => {
    const p = tgBase({ new_chat_members: [{ id: 42 }] });
    expect(synthTelegramText(p)).toBe('[member_joined]');
  });

  test('empty payload returns empty string', () => {
    expect(synthTelegramText(tgBase({}))).toBe('');
  });
});
