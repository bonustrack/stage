/** @file Type of the injected Railgun bridge dispatcher: the Stage client owns the typed frame builders (shield/transfer/unshield) but the host (apps/app) implements this over its bridge sdk()/rawCall(), each builder invoking one whitelisted @railgun-community/wallet operation by name + positional args. */

import type { SdkMethod } from './methods';

/** Invokes a whitelisted SDK method by name with positional args, returning the host's JSON-serialized result (bigint -> decimal string); `method` is the SdkMethod literal union so a name outside the shared registry is a compile error. */
export type RailgunDispatch = <T = unknown>(method: SdkMethod, args?: readonly unknown[]) => Promise<T>;
