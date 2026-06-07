/** Metro-custom XMTP content codecs (poll + signature request/reference). */

import { ReactionCodec } from '@xmtp/content-type-reaction';
import { ReplyCodec } from '@xmtp/content-type-reply';
import { AttachmentCodec, RemoteAttachmentCodec } from '@xmtp/content-type-remote-attachment';
import { ContentTypeId, type ContentCodec, type EncodedContent } from '@xmtp/content-type-primitives';
import { WalletSendCallsCodec } from '@xmtp/content-type-wallet-send-calls';
import { TransactionReferenceCodec } from '@xmtp/content-type-transaction-reference';

const enc = (o: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(o));
const dec = <T>(e: EncodedContent): T => JSON.parse(new TextDecoder().decode(e.content)) as T;

export const ContentTypePoll = new ContentTypeId(
  { authorityId: 'metro.box', typeId: 'poll', versionMajor: 1, versionMinor: 0 });
// Poll wire schema modeled on Claude Code's AskUserQuestion tool: a question
// plus a short `header` chip, a `multiSelect` flag, and `options` as
// {label, description}. Kept structurally compatible with the shared schema in
// @stage-labs/client/xmtp/poll (defined inline here so the daemon train has no
// cross-package import to resolve). Backward-compat: the optional `string[]`
// member of the union still decodes legacy flat-option polls without throwing.
export type PollOption = { label: string; description?: string };
export type PollContent = {
  question: string;
  /** Short ALL-CAPS eyebrow, <= ~12 chars (AskUserQuestion `header`). */
  header?: string;
  /** true => voters may select multiple options. */
  multiSelect?: boolean;
  /** Stable id minted at creation so votes can reference the poll. */
  pollId?: string;
  /** AskUserQuestion-shaped options. Legacy polls may carry plain strings. */
  options?: (PollOption | string)[];
  [k: string]: unknown;
};
export class PollCodec implements ContentCodec<PollContent> {
  get contentType() { return ContentTypePoll; }
  encode(c: PollContent): EncodedContent {
    return { type: ContentTypePoll, parameters: {}, fallback: `📊 Poll: ${c.question}`, content: enc(c) };
  }
  decode(e: EncodedContent): PollContent { return dec<PollContent>(e); }
  fallback(c: PollContent) { return `📊 Poll: ${c.question}`; }
  shouldPush() { return true; }
}

// Metro signature content types — `metro.box/signatureRequest:1.0` (a request to
// sign EIP-712 typed data or a personal_sign string) + `…/signatureReference:1.0`
// (the signature posted back). JSON encode/decode like PollCodec.
export const ContentTypeSignatureRequest = new ContentTypeId(
  { authorityId: 'metro.box', typeId: 'signatureRequest', versionMajor: 1, versionMinor: 0 });
export type SignatureRequestContent = {
  id?: string; kind?: 'eip712' | 'personal'; eip712?: unknown;
  message?: string; description?: string; [k: string]: unknown;
};
export class SignatureRequestCodec implements ContentCodec<SignatureRequestContent> {
  get contentType() { return ContentTypeSignatureRequest; }
  private fb(c: SignatureRequestContent) {
    return c.description ? `[Signature request] ${c.description}` : '[Signature request]';
  }
  encode(c: SignatureRequestContent): EncodedContent {
    return { type: ContentTypeSignatureRequest, parameters: {}, fallback: this.fb(c), content: enc(c) };
  }
  decode(e: EncodedContent): SignatureRequestContent { return dec<SignatureRequestContent>(e); }
  fallback(c: SignatureRequestContent) { return this.fb(c); }
  shouldPush() { return true; }
}

export const ContentTypeSignatureReference = new ContentTypeId(
  { authorityId: 'metro.box', typeId: 'signatureReference', versionMajor: 1, versionMinor: 0 });
export type SignatureReferenceContent = {
  requestId?: string; signature: string; signer?: string; [k: string]: unknown;
};
export class SignatureReferenceCodec implements ContentCodec<SignatureReferenceContent> {
  get contentType() { return ContentTypeSignatureReference; }
  private fb(c: SignatureReferenceContent) { return c.signature ? `[Signature] ${c.signature}` : '[Signature]'; }
  encode(c: SignatureReferenceContent): EncodedContent {
    return { type: ContentTypeSignatureReference, parameters: {}, fallback: this.fb(c), content: enc(c) };
  }
  decode(e: EncodedContent): SignatureReferenceContent { return dec<SignatureReferenceContent>(e); }
  fallback(c: SignatureReferenceContent) { return this.fb(c); }
  shouldPush() { return true; }
}

export const CODECS = () => [
  new ReactionCodec(), new ReplyCodec(), new AttachmentCodec(), new RemoteAttachmentCodec(),
  new PollCodec(), new WalletSendCallsCodec(), new TransactionReferenceCodec(),
  new SignatureRequestCodec(), new SignatureReferenceCodec(),
];
