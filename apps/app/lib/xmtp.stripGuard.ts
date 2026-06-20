
import type { SanitizedFileUri, sanitizeFileUri } from './xmtp.swarm';
import type { encryptSanitizedAttachment } from './xmtp.attachments';

type AssertAssignable<B, A extends B> = A;

type IsAssignable<A, B> = [A] extends [B] ? true : false;

type AssertFalse<T extends false> = T;

type BoundaryFileUri = Parameters<typeof encryptSanitizedAttachment>[1]['fileUri'];

type _RawStringRejected = AssertFalse<IsAssignable<string, BoundaryFileUri>>;

type _ProducerAccepted = AssertAssignable<
  BoundaryFileUri,
  Awaited<ReturnType<typeof sanitizeFileUri>>
>;

type _SameBrand = AssertAssignable<
  Awaited<ReturnType<typeof sanitizeFileUri>>,
  SanitizedFileUri
>  ;

export type StripGuards = [_RawStringRejected, _ProducerAccepted, _SameBrand];
