import { expect, test } from 'bun:test';
import { canApproveConversation, canComposeConversation } from '../components/conversation/consent.model';

test('a hidden channel opened by link offers approval after membership is confirmed', () => {
  expect(canApproveConversation('denied', true, 'member')).toBe(true);
  expect(canApproveConversation('unknown', true, 'member')).toBe(true);
  expect(canApproveConversation('allowed', true, 'member')).toBe(false);
});

test('the composer waits for known membership and deliberate approval of hidden groups', () => {
  expect(canComposeConversation('allowed', true, 'checking')).toBe(false);
  expect(canComposeConversation('allowed', true, 'waiting')).toBe(false);
  expect(canComposeConversation('allowed', true, 'outside')).toBe(false);
  expect(canComposeConversation(undefined, true, 'member')).toBe(false);
  expect(canComposeConversation('denied', true, 'member')).toBe(false);
  expect(canComposeConversation('allowed', true, 'member')).toBe(true);
  expect(canComposeConversation('unknown', false, 'member')).toBe(true);
});

test('incomplete membership and removed channels never offer a misleading approval', () => {
  expect(canApproveConversation('denied', true, 'waiting')).toBe(false);
  expect(canApproveConversation('unknown', true, 'outside')).toBe(false);
  expect(canApproveConversation('denied', false, 'member')).toBe(false);
  expect(canApproveConversation('unknown', false, 'member')).toBe(true);
});
