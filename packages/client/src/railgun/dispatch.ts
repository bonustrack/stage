/** The injected Railgun bridge dispatcher.
 *
 *  The Stage client owns the typed FRAME builders (shield / transfer / unshield
 *  call shapes) but never touches the nodejs-mobile native module. The host
 *  (apps/app) implements this dispatcher over its bridge `sdk()` / `rawCall()`
 *  and injects it as part of the RailgunTransport. Each builder composes one
 *  whitelisted @railgun-community/wallet operation by name + positional args. */

/** Invoke a whitelisted SDK method by name with positional args. The result is
 *  whatever the SDK fn returns, JSON-serialized (bigint -> decimal string) by
 *  the host. Generic by design: callers cast to the concrete result. */
export type RailgunDispatch = <T = unknown>(method: string, args?: readonly unknown[]) => Promise<T>;
