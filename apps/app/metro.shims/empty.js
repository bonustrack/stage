/** Empty module shim for node-core builtins that the RAILGUN SDK / ethers /
 *  axios reach for transitively but that React Native cannot provide and the
 *  reachable code paths never actually exercise at runtime (net / tls / fs /
 *  http / https socket internals, etc.). Resolving them to this no-op keeps the
 *  Metro bundle building; any code that genuinely tried to use them would fail
 *  loudly at call time, but the RN/browser branches of these libs do not. */
module.exports = {};
