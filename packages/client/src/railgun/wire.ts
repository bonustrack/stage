/**
 * @file Bigint wire-encoding helpers ({ __bigint }) so Railgun bridge amounts survive the JSON channel to the Node host.
 */
/**
 * Wire-encoding helpers for the Railgun bridge protocol.
 *
 *  The bridge channel is JSON, which cannot carry a bigint. The shield/transfer
 *  SDK primitives (populateShield / populateShieldBaseToken / gasEstimate*) take
 *  bigint `amount`s and do real bigint arithmetic on them in the Node host, so a
 *  plain number/string silently breaks the commitment math. We therefore wrap
 *  every bigint arg as { __bigint: "<decimal>" } on the way out; the host's
 *  dispatcher revives the marker back into a real bigint before invoking the SDK
 *  (see apps/app nodejs-assets/nodejs-project/sdkDispatch.js `revive`).
 *
 *  PURE: no react-native / expo / native imports. The frame builders below are
 *  framework-agnostic; the actual transport that ships them is injected via the
 *  Stage client's RailgunTransport.
 */

/** The on-wire marker for a bigint value the host must revive. */
export interface BigIntWire {
  __bigint: string;
}

/** Wrap a bigint (or decimal-string wei) as the wire marker the host revives. */
export function bn(value: bigint | string): BigIntWire {
  return { __bigint: typeof value === 'bigint' ? value.toString() : value };
}
