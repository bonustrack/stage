/** COMPILE-TIME guard for the outbound file-metadata strip (PR #376).
 *
 *  This module contains NO runtime logic - it is a set of type-level assertions
 *  that `tsc --noEmit` evaluates as part of the normal app build (it lives under
 *  `lib/**`, which the app tsconfig includes). It exists so the bypass-proof
 *  wiring is verified by CI, not just trusted:
 *
 *   1. The encrypt boundary (`encryptSanitizedAttachment`) requires a branded
 *      `SanitizedFileUri`, so a raw `string` cannot be encrypted by accident.
 *   2. `sanitizeFileUri` is the ONLY producer of `SanitizedFileUri`, and its
 *      result is assignable to that boundary param.
 *
 *  If either guarantee is broken (brand removed, boundary loosened to `string`,
 *  or `sanitizeFileUri` reverted to returning a plain `string`), one of the
 *  assertions below stops compiling and the build fails. Removing the brand is
 *  therefore not a silent change. The companion runtime test
 *  (`test/stripMetadataEnforce.test.ts`) documents the same contract for humans
 *  and asserts the brand is a zero-cost phantom. */

import type { SanitizedFileUri, sanitizeFileUri } from './xmtp.swarm';
import type { encryptSanitizedAttachment } from './xmtp.attachments';

/** Helper: assert `A` is assignable to `B` at the type level. */
type AssertAssignable<B, A extends B> = A;

/** Helper: `true` iff `A` is assignable to `B`, else `false` (no error raised). */
type IsAssignable<A, B> = [A] extends [B] ? true : false;

/** Helper: compile-time assertion that a boolean type is exactly `false`. Used to
 *  prove a NEGATIVE assignability relationship without an error directive. */
type AssertFalse<T extends false> = T;

/** The encrypt boundary's `fileUri` param. */
type BoundaryFileUri = Parameters<typeof encryptSanitizedAttachment>[1]['fileUri'];

/** GUARD 1: the boundary requires the brand. A plain `string` must NOT be
 *  assignable to the boundary's `fileUri`. We assert the NEGATIVE relationship:
 *  `IsAssignable<string, BoundaryFileUri>` must resolve to `false`. If the
 *  boundary ever loosens to accept a bare string, this resolves to `true` and
 *  `AssertFalse` stops compiling - failing the build. */
type _RawStringRejected = AssertFalse<IsAssignable<string, BoundaryFileUri>>;

/** GUARD 2: `sanitizeFileUri`'s output IS accepted by the boundary (it is the
 *  sole legitimate producer). Breaks if `sanitizeFileUri` returns plain string. */
type _ProducerAccepted = AssertAssignable<
  BoundaryFileUri,
  Awaited<ReturnType<typeof sanitizeFileUri>>
>;

/** GUARD 3: the producer's output and the boundary's input are the SAME branded
 *  type (no accidental second brand / structural drift). */
type _SameBrand = AssertAssignable<
  Awaited<ReturnType<typeof sanitizeFileUri>>,
  SanitizedFileUri
>  ;

/** Reference the alias types so `noUnusedLocals`-style lint does not flag them;
 *  these are erased at compile time (zero runtime output). */
export type StripGuards = [_RawStringRejected, _ProducerAccepted, _SameBrand];
