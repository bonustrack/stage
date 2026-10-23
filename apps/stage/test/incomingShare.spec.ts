import { describe, expect, mock, test } from 'bun:test';
import { acceptedShareConsent, mergeShareRows, parseIncomingShare, sharedAttachments, shareDestinations, shareError } from '../components/share/share.model';
import { currentShareDraft, makeShareSender } from '../components/share/shareSend.model';
import { planSendSteps } from '../components/composer/send.model';
import { sendPreparedMessage } from '../lib/xmtp.messageSend.core';

const id = 'f1363f20-9a10-4e7c-9adc-5da913462fc4';
const file = (index = 0, size = 1_024) => ({ uri: `file:///data/user/0/box.stage/cache/stage-shares/${id}/${index}`, name: 'photo.png', mimeType: 'image/png', size });
const ready = (files: unknown[] = [file()]) => ({ id, status: 'ready', files });

function sendEffects() {
  return {
    validate: mock(async () => () => { return; }), start: mock(() => 'started'),
    finish: mock(async () => true), success: mock(async () => { return; }),
    busy: mock((value: boolean) => value), error: mock(() => { return; }),
  };
}

describe('incoming share boundary', () => {
  test('loading and errors contain only an event identifier and static error code', () => {
    expect(parseIncomingShare({ id, status: 'loading', uri: 'private' })).toEqual({ id, status: 'loading' });
    expect(shareError('private provider error')).not.toContain('private provider error');
    expect(parseIncomingShare(null)).toBeNull();
    expect(parseIncomingShare({ id: '../escape', status: 'ready' })).toBeNull();
  });

  test('real repeated events with identical files remain distinct', () => {
    const nextId = 'a1363f20-9a10-4e7c-9adc-5da913462fc4';
    const first = parseIncomingShare(ready());
    const next = parseIncomingShare({ ...ready(), id: nextId, files: [{ ...file(), uri: file().uri.replace(id, nextId) }] });
    expect(first?.id).not.toBe(next?.id);
    expect(first?.status).toBe('ready');
    expect(next?.status).toBe('ready');
  });

  test('maps image, video and generic files into the existing attachment shape', () => {
    const share = parseIncomingShare(ready([file(), { ...file(1), name: 'clip.mp4', mimeType: 'video/mp4' }, { ...file(2), name: 'document.pdf', mimeType: 'application/pdf' }]));
    if (share?.status !== 'ready') throw new Error('Missing share');
    const attachments = sharedAttachments(share);
    expect(attachments.map(item => item.kind)).toEqual(['image', 'video', 'file']);
    expect(attachments.map(item => item.name)).toEqual(['photo.png', 'clip.mp4', 'document.pdf']);
    expect(attachments[0]?.url).toBe(file().uri);
  });

  test('enforces exact file and aggregate byte bounds', () => {
    const max = 25 * 1024 * 1024;
    expect(parseIncomingShare(ready([file(0, max), file(1, max)]))?.status).toBe('ready');
    for (const size of [0, -1, NaN, Infinity, 1.5, max + 1]) expect(parseIncomingShare(ready([file(0, size)]))?.status).toBe('error');
    expect(parseIncomingShare(ready([file(0, max), file(1, max), file(2)]))?.status).toBe('error');
    expect(parseIncomingShare(ready(Array.from({ length: 11 }, (_, index) => file(index))))?.status).toBe('error');
    expect(parseIncomingShare(ready([]))?.status).toBe('error');
    expect(parseIncomingShare(ready([file(), file()]))?.status).toBe('error');
  });

  test('rejects external URLs, content grants and paths outside this private import', () => {
    const invalid = ['https://example.test/private', 'content://provider/private', 'file:///etc/passwd', `${file().uri}?token=secret`, `${file().uri.slice(0, -1)}invalid`, file().uri.replace('/cache/', '/cache/../'), file().uri.replace(id, 'other'), file().uri.replace('/stage-shares/', '/stage-shares/%2e%2e/')];
    for (const uri of invalid) expect(parseIncomingShare(ready([{ ...file(), uri }]))?.status).toBe('error');
  });

  test('rejects provider-controlled path names, control characters and invalid MIME', () => {
    for (const name of ['../private', 'C:\\private', 'bad\nname', '', 'x'.repeat(161)]) expect(parseIncomingShare(ready([{ ...file(), name }]))?.status).toBe('error');
    expect(parseIncomingShare(ready([{ ...file(), mimeType: 'text/html;private' }]))?.status).toBe('error');
  });

  test('account-scoped hidden state denies shares and preserves existing group unhide semantics', () => {
    expect(acceptedShareConsent(true, true, 'allowed')).toBe(false);
    expect(acceptedShareConsent(false, true, 'allowed')).toBe(false);
    expect(acceptedShareConsent(false, false, 'denied')).toBe(false);
    expect(acceptedShareConsent(true, undefined, 'unknown')).toBe(false);
    expect(acceptedShareConsent(true, undefined, 'allowed')).toBe(true);
    expect(acceptedShareConsent(true, false, 'denied')).toBe(true);
  });

  test('cache updates retain newly discovered destinations while applying changed rows', () => {
    const discovered = { convId: 'new', title: 'New channel' };
    const previous = { convId: 'old', title: 'Old title' };
    const changed = { ...previous, title: 'Changed title' };
    expect(mergeShareRows([discovered, previous], [changed])).toEqual([discovered, changed]);
    expect(mergeShareRows(null, [changed])).toEqual([changed]);
    expect(mergeShareRows([discovered], null)).toEqual([discovered]);
  });

  test('only offers accepted existing destinations, never sync groups or deleted chats', () => {
    const base = { convId: 'channel', title: 'Design', unreadCount: 0, lastReadNs: 0, consent: 'allowed', peerAddress: null };
    const rows = [base, { ...base, convId: 'request', consent: 'unknown' }, { ...base, convId: 'blocked', consent: 'denied' }, { ...base, convId: 'sync', groupName: 'stage.sync:owner' }, { ...base, convId: 'deleted', peerAddress: '0xpeer', lastBubbleTs: 10 }];
    expect(shareDestinations(rows, { '0xpeer': 11 }, 'DES')).toEqual([{ convId: 'channel', title: 'Design', peerAddress: null, avatarUri: null, lastBubbleTs: null }]);
    expect(shareDestinations(null, {}, '')).toEqual([]);
    expect(shareDestinations(rows, {}, 'missing')).toEqual([]);
  });
});

describe('explicit share send gate', () => {
  test('instant failure treats the original React snapshot as cleared before restoring unsent content', () => {
    const started = { text: 'caption', pending: [file()] };
    expect(currentShareDraft(started, started)).toEqual({ text: '', pending: [] });
    const changed = { text: 'new caption', pending: [file(1)] };
    expect(currentShareDraft(changed, started)).toEqual(changed);
    expect(currentShareDraft({ text: '', pending: [] }, started)).toEqual({ text: '', pending: [] });
  });

  test('creating and reviewing a share invokes no send or upload effects', () => {
    const effects = sendEffects();
    const sender = makeShareSender(effects);
    expect(sender.isBusy()).toBe(false);
    expect(effects.validate).not.toHaveBeenCalled();
    expect(effects.start).not.toHaveBeenCalled();
  });

  test('Cancel synchronously prevents a queued Send from validating or uploading', async () => {
    const effects = sendEffects();
    const sender = makeShareSender(effects);
    expect(sender.close()).toBe(true);
    await sender.send();
    expect(effects.validate).not.toHaveBeenCalled();
    expect(effects.start).not.toHaveBeenCalled();
    expect(effects.success).not.toHaveBeenCalled();
  });

  test('double taps share one synchronous latch through validation and sending', async () => {
    const checked = Promise.withResolvers<() => void>();
    const effects = sendEffects();
    effects.validate.mockImplementation(() => checked.promise);
    const sender = makeShareSender(effects);
    const first = sender.send();
    await sender.send();
    expect(effects.validate).toHaveBeenCalledTimes(1);
    expect(effects.start).not.toHaveBeenCalled();
    checked.resolve(() => { return; });
    await first;
    expect(effects.start).toHaveBeenCalledTimes(1);
    expect(effects.success).toHaveBeenCalledTimes(1);
    expect(effects.busy.mock.calls).toEqual([[true], [false]]);
  });

  test('account changes during validation abort before upload or send', async () => {
    const effects = sendEffects();
    effects.validate.mockImplementation(async () => () => { throw new Error('Account changed'); });
    await makeShareSender(effects).send();
    expect(effects.start).not.toHaveBeenCalled();
    expect(effects.success).not.toHaveBeenCalled();
    expect(effects.error).toHaveBeenCalledTimes(1);
  });

  test('failed sends remain reviewable without consuming their native files', async () => {
    const effects = sendEffects();
    effects.finish.mockImplementation(async () => false);
    const sender = makeShareSender(effects);
    await sender.send();
    expect(effects.success).not.toHaveBeenCalled();
    expect(sender.isBusy()).toBe(false);
    await sender.send();
    expect(effects.start).toHaveBeenCalledTimes(2);
  });

  test.each([undefined, 'reference'])('caption acceptance is rechecked after transport preparation with reply %s', async replyTo => {
    const prepared = Promise.withResolvers<{ id: string }>();
    const entered = Promise.withResolvers<boolean>();
    let allowed = true;
    const validate = mock(async () => { if (!allowed) throw new Error('Destination changed'); });
    const transport = mock(async () => 'sent-caption');
    const submit = (guard?: () => Promise<void>) => sendPreparedMessage(() => { entered.resolve(true); return prepared.promise; }, transport, guard);
    const steps = planSendSteps('line', 'caption', [], replyTo, {
      text: (_line, _text, guard) => submit(guard), reply: (_line, _reply, _text, guard) => submit(guard), attachments: mock(async () => 'files'),
    }, () => 'local', () => { return; }, validate);
    const result = steps[0]?.run();
    await entered.promise;
    expect(validate).toHaveBeenCalledTimes(1);
    allowed = false;
    prepared.resolve({ id: 'channel' });
    await expect(result).rejects.toThrow('Destination changed');
    expect(validate).toHaveBeenCalledTimes(2);
    expect(transport).not.toHaveBeenCalled();
  });

  test('late caption validation retains the initiating account guard', async () => {
    let current = true;
    let checks = 0;
    const transport = mock(async () => 'sent-caption');
    const steps = planSendSteps('line', 'caption', [], undefined, {
      text: (_line, _text, guard) => sendPreparedMessage(async () => 'channel', transport, guard),
      reply: mock(async () => 'reply'), attachments: mock(async () => 'files'),
    }, () => 'local', () => { if (!current) throw new Error('Account changed'); }, async () => { if (++checks === 2) current = false; });
    await expect(steps[0]?.run()).rejects.toThrow('Account changed');
    expect(transport).not.toHaveBeenCalled();
  });

  test('account changes between text and attachment steps block the remaining transport', async () => {
    let current = true;
    const text = mock(async () => 'sent-text');
    const attachments = mock(async () => 'sent-files');
    const steps = planSendSteps('original-channel', 'caption', [{ id: 'file', url: file().uri, name: 'photo.png', mime: 'image/png', kind: 'image', size: 1_024 }], undefined,
      { text, attachments, reply: mock(async () => 'reply') }, () => 'local', () => { if (!current) throw new Error('Account changed'); });
    expect(text).not.toHaveBeenCalled();
    expect(await steps[0]?.run()).toBe('sent-text');
    current = false;
    expect(() => steps[1]?.run()).toThrow('Account changed');
    expect(attachments).not.toHaveBeenCalled();
  });
});
