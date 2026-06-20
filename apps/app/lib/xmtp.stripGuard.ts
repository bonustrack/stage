/** @file Compile-time type-level guard (no runtime logic) for the outbound file-metadata strip, asserting the branded `SanitizedFileUri` boundary holds so the build fails if the brand is removed or loosened (PR #376). */

import type { SanitizedFileUri, sanitizeFileUri } from './xmtp.swarm';
import type { encryptSanitizedAttachment } from './xmtp.attachments';

/** Helper: assert `A` is assignable to `B` at the type level. */
type AssertAssignable<B, A extends B> = A;

/** Helper: `true` iff `A` is assignable to `B`, else `false` (no error raised). */
type IsAssignable<A, B> = [A] extends [B] ? true : false;

/** Helper: compile-time assertion that a boolean type is exactly `false`. Used to prove a NEGATIVE assignability relationship without an error directive. */
type AssertFalse<T extends false> = T;

/** The encrypt boundary's `fileUri` param. */
type BoundaryFileUri = Parameters<typeof encryptSanitizedAttachment>[1]['fileUri'];

/** GUARD 1: the boundary requires the brand — assert the NEGATIVE relationship that a plain `string` is NOT assignable, so if the boundary ever loosens to accept a bare string `AssertFalse` stops compiling and fails the build. */
type _RawStringRejected = AssertFalse<IsAssignable<string, BoundaryFileUri>>;

/** GUARD 2: `sanitizeFileUri`'s output IS accepted by the boundary (it is the sole legitimate producer). Breaks if `sanitizeFileUri` returns plain string. */
type _ProducerAccepted = AssertAssignable<
  BoundaryFileUri,
  Awaited<ReturnType<typeof sanitizeFileUri>>
>;

/** GUARD 3: the producer's output and the boundary's input are the SAME branded type (no accidental second brand / structural drift). */
type _SameBrand = AssertAssignable<
  Awaited<ReturnType<typeof sanitizeFileUri>>,
  SanitizedFileUri
>  ;

/** Reference the alias types so `noUnusedLocals`-style lint does not flag them; these are erased at compile time (zero runtime output). */
export type StripGuards = [_RawStringRejected, _ProducerAccepted, _SameBrand];
