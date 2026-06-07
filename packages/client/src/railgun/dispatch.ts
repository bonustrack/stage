/** The injected Railgun bridge dispatcher.
 *
 *  The Stage client owns the typed FRAME builders (shield / transfer / unshield
 *  call shapes) but never touches the nodejs-mobile native module. The host
 *  (apps/app) implements this dispatcher over its bridge `sdk()` / `rawCall()`
 *  and injects it as part of the RailgunTransport. Each builder composes one
 *  whitelisted @railgun-community/wallet operation by name + positional args. */

import type { SdkMethod } from './methods';

/** Invoke a whitelisted SDK method by name with positional args. The result is
 *  whatever the SDK fn returns, JSON-serialized (bigint -> decimal string) by
 *  the host. Generic by design: callers cast to the concrete result.
 *
 *  `method` is the SdkMethod literal union (driven by ./methods SDK_METHODS), so
 *  a name not in the shared registry is a COMPILE error here — a frame builder
 *  cannot reference a primitive the host whitelist does not also carry. */
export type RailgunDispatch = <T = unknown>(method: SdkMethod, args?: readonly unknown[]) => Promise<T>;
