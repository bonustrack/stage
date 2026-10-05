import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { ensureMailKey, fetchMail, listMail, openMailSession, type MailListItem, type MailSession, type SignMessage } from '@stage-labs/client/mail/api';
import { deriveMailKey, isMailboxLabel, mailAddressOf, openMailIndex, openMailPart, type MailIndex, type MailKeyPair } from '@stage-labs/client/mail/mailbox';
import { parseMail, type ParsedMail } from '@stage-labs/client/mail/mime';
import type { InboxEntry } from '../components/settings/Inbox.model';
import { report, reported } from './errorPolicy';

export interface Mailbox {
  accountId: string;
  address: string;
  label: string;
  mailAddress: string;
  selection: number;
}

export interface InboxState {
  entries: InboxEntry[];
  failed: string[];
}

interface MailDeps {
  activeAccount: () => Promise<AccountRecord | null>;
  ownedLabel: (address: string) => Promise<string | null>;
  signer: (rec: AccountRecord) => Promise<SignMessage>;
  selection: () => number;
  baseUrl: () => string;
}

const SESSION_MARGIN_MS = 30_000;

export function mailboxKey(box: Mailbox): string {
  return `${box.accountId}/${box.address.toLowerCase()}/${box.label}`;
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const pending = make();
  cache.set(key, pending);
  pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  return pending;
}

function openIndex(keys: MailKeyPair, box: Mailbox, item: MailListItem): MailIndex | null {
  try {
    return openMailIndex(keys.secretKey, box.label, item.id, item.index);
  } catch (err) {
    report('mail.index', err);
    return null;
  }
}

function mailCredentials(deps: MailDeps) {
  const signers = new Map<string, Promise<SignMessage>>();
  const keys = new Map<string, Promise<MailKeyPair>>();
  const sessions = new Map<string, Promise<MailSession>>();
  const activated = new Set<string>();
  function check(selection: number): void {
    if (selection !== deps.selection()) throw new Error('The active account changed.');
  }
  async function current<T>(selection: number, run: () => Promise<T>): Promise<T> {
    check(selection);
    const value = await run();
    check(selection);
    return value;
  }
  const forBox = <T>(box: Mailbox, cache: Map<string, Promise<T>>, make: () => Promise<T>): Promise<T> =>
    current(box.selection, () => cached(cache, mailboxKey(box), make));
  const signerFor = (box: Mailbox): Promise<SignMessage> => forBox(box, signers, async () => {
    const rec = await current(box.selection, deps.activeAccount);
    if (rec?.id !== box.accountId || rec.address.toLowerCase() !== box.address.toLowerCase()) {
      throw new Error('This mailbox is not in the active account.');
    }
    const sign = await current(box.selection, () => deps.signer(rec));
    return (message) => current(box.selection, () => sign(message));
  });
  const keyFor = (box: Mailbox): Promise<MailKeyPair> =>
    forBox(box, keys, async () => deriveMailKey(box.label, await signerFor(box)));
  async function sessionFor(box: Mailbox): Promise<MailSession> {
    const open = async (): Promise<MailSession> => openMailSession(deps.baseUrl(), box.label, await signerFor(box));
    const session = await forBox(box, sessions, open);
    if (session.expiresAt - SESSION_MARGIN_MS > Date.now()) return session;
    sessions.delete(mailboxKey(box));
    return forBox(box, sessions, open);
  }
  async function withSession<T>(box: Mailbox, run: (session: MailSession) => Promise<T>): Promise<T> {
    const read = async (): Promise<T> => {
      const session = await sessionFor(box);
      return current(box.selection, () => run(session));
    };
    try {
      return await read();
    } catch (err) {
      check(box.selection);
      report('mail.session', err);
      sessions.delete(mailboxKey(box));
      return read();
    }
  }
  async function activate(box: Mailbox): Promise<void> {
    check(box.selection);
    if (activated.has(mailboxKey(box))) return;
    const sign = await signerFor(box);
    await current(box.selection, () => ensureMailKey(deps.baseUrl(), box.label, box.address, sign));
    activated.add(mailboxKey(box));
  }
  return {
    current, keyFor, withSession, activate,
    clear: () => { signers.clear(); keys.clear(); sessions.clear(); activated.clear(); },
  };
}

export function makeMailAccess(deps: MailDeps) {
  const credentials = mailCredentials(deps);
  const { current, keyFor, withSession } = credentials;
  async function listBox(box: Mailbox): Promise<InboxEntry[]> {
    void credentials.activate(box).catch(reported('mail.activate'));
    const [keys, items] = await current(box.selection, () => Promise.all([keyFor(box), withSession(box, listMail)]));
    return items.map((item) => ({ label: box.label, id: item.id, ts: item.ts, size: item.size, index: openIndex(keys, box, item) }));
  }
  return {
    clear: credentials.clear,
    mailboxes: (selection: number): Promise<Mailbox[]> => current(selection, async () => {
      const rec = await current(selection, deps.activeAccount);
      if (rec === null) return [];
      const label = await current(selection, () => deps.ownedLabel(rec.address));
      if (label === null || !isMailboxLabel(label)) return [];
      return [{ accountId: rec.id, address: rec.address, label, mailAddress: mailAddressOf(label), selection }];
    }),
    inbox: (boxes: readonly Mailbox[], selection: number): Promise<InboxState> => current(selection, async () => {
      const results = await Promise.allSettled(boxes.map(listBox));
      const state: InboxState = { entries: [], failed: [] };
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') state.entries.push(...result.value);
        else state.failed.push(boxes[i]?.mailAddress ?? '');
      });
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected !== undefined && state.failed.length === boxes.length) throw rejected.reason;
      return state;
    }),
    mail: (box: Mailbox, id: string): Promise<ParsedMail> => current(box.selection, async () => {
      const [keys, sealed] = await current(box.selection, () => Promise.all([keyFor(box), withSession(box, (session) => fetchMail(session, id))]));
      return parseMail(openMailPart(keys.secretKey, box.label, id, 'body', sealed));
    }),
  };
}
