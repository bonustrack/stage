import { describe, expect, test } from 'bun:test';
import {
  profileAddressNode,
  profileDisplayName,
  profileMessageSendNode,
  profileNameNode,
  profileOverlayHeaderNode,
} from '../src/profile/profileScreenModel';
import { PROFILE_ADDRESS_COPY, PROFILE_ROUND_PRESS } from '../src/actions';

describe('profileDisplayName', () => {
  test('empty address shows loading placeholder', () => {
    expect(profileDisplayName('', 'alice', '0x12…cd')).toBe('Loading…');
  });

  test('resolved name wins and is trimmed', () => {
    expect(profileDisplayName('0xabc', '  alice.eth  ', '0x12…cd')).toBe('alice.eth');
  });

  test('missing or blank name falls back to short address', () => {
    expect(profileDisplayName('0xabc', undefined, '0x12…cd')).toBe('0x12…cd');
    expect(profileDisplayName('0xabc', null, '0x12…cd')).toBe('0x12…cd');
    expect(profileDisplayName('0xabc', '   ', '0x12…cd')).toBe('0x12…cd');
  });
});

describe('profile nodes', () => {
  test('name node wraps profileHeader in a Basic root', () => {
    const node = profileNameNode('alice.eth');
    expect(node.type).toBe('Basic');
    expect(JSON.stringify(node)).toContain('"alice.eth"');
  });

  test('address node carries the copy payload and label', () => {
    const node = profileAddressNode({ address: '0xabc', label: '0x12…cd', color: '#111' });
    const json = JSON.stringify(node);
    expect(json).toContain(PROFILE_ADDRESS_COPY);
    expect(json).toContain('"0xabc"');
    expect(json).toContain('"0x12…cd"');
  });

  test('message/send node renders both round actions', () => {
    const json = JSON.stringify(profileMessageSendNode({ border: '#eee', fg: '#00f' }, false));
    expect(json).toContain('"Message"');
    expect(json).toContain('"Send"');
    expect(json).toContain(PROFILE_ROUND_PRESS);
    expect(json).not.toContain('"Opening…"');
  });

  test('opening state swaps the message label and disables the button', () => {
    const json = JSON.stringify(profileMessageSendNode({ border: '#eee', fg: '#00f' }, true));
    expect(json).toContain('"Opening…"');
    expect(json).toContain('"disabled":true');
  });

  test('overlay header positions absolutely with back arrow and safe top padding', () => {
    const json = JSON.stringify(profileOverlayHeaderNode('#00f', 44));
    expect(json).toContain('"position":"absolute"');
    expect(json).toContain('"top":44');
    expect(json).toContain('"arrowLeft"');
    const noInset = JSON.stringify(profileOverlayHeaderNode('#00f'));
    expect(noInset).toContain('"position":"absolute"');
  });
});
