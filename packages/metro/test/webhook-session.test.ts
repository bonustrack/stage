/**
 * PR7 — webhook → session routing. The binding is fully ADDITIVE: an endpoint
 * with no `session` mints exactly today's event (parity), while a bound endpoint
 * attributes its event to `metro://session/<id>` so feed isolation routes it.
 */

import { describe, expect, test } from 'bun:test';
import { webhookEntry } from '../src/dispatcher/server.ts';
import { passesMode } from '../src/broker/history-stream.ts';
import { sessionOwner } from '../src/sessions.ts';
import { Line, asLine } from '../src/lines.ts';
import type { Endpoint } from '../src/tunnel.ts';

const ep = (over: Partial<Endpoint> = {}): Endpoint => ({
  id: 'abc123', label: 'gh', createdAt: '2026-06-10T00:00:00.000Z', ...over,
});
const headers = { 'x-github-event': 'push', 'x-github-delivery': 'd-1' };

describe('webhook → session routing (additive)', () => {
  test('NO binding ⇒ today behavior: to === webhook line, no session field', () => {
    const e = webhookEntry(ep(), headers, { a: 1 }, 'POST', '/wh/abc123');
    const line = Line.webhook('abc123');
    expect(e.to).toBe(line);
    expect(e.from).toBe(line);
    expect(e.line).toBe(line);
    expect(e.station).toBe('webhook');
    expect(e.lineName).toBe('gh');
    expect(e.messageId).toBe('d-1');
    expect(e.text).toBe('push POST /wh/abc123');
    expect(e.payload).toEqual({ headers, body: { a: 1 } });
  });

  test('NO binding ⇒ excluded from a personal feed (unchanged isolation)', () => {
    const e = webhookEntry(ep(), headers, {}, 'POST', '/wh/abc123');
    const self = asLine('metro://session/me');
    // mine-only must NOT surface an unbound webhook to a session owner
    expect(passesMode(e, 'mine-only', self, {})).toBe(false);
  });

  test('bound endpoint ⇒ to = session owner, surfaces in that session feed', () => {
    const e = webhookEntry(ep({ session: 'me' }), headers, {}, 'POST', '/wh/abc123');
    const owner = sessionOwner('me');
    expect(e.to).toBe(owner);
    // line/from stay the webhook line — only attribution (`to`) changes
    expect(e.line).toBe(Line.webhook('abc123'));
    expect(e.from).toBe(Line.webhook('abc123'));
    // now it routes to that owner's personal feed (to === self wins in passesMode)
    expect(passesMode(e, 'mine-only', owner, {})).toBe(true);
    // and stays OUT of a different session's feed
    expect(passesMode(e, 'mine-only', sessionOwner('other'), {})).toBe(false);
  });
});
