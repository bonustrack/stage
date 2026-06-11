// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @notice Verifies the gateway operator's signature over a CCIP-Read response.
///  Mirrors ensdomains/offchain-resolver's SignatureVerifier so the gateway in
///  packages/metro/src/stations/usernames/resolver.ts (which signs
///  keccak256(0x1900 ++ target ++ expires ++ keccak256(request) ++
///  keccak256(result))) verifies here without modification.
library SignatureVerifier {
    /// @dev Recreates the signing hash. `target` is this resolver's address.
    function makeSignatureHash(
        address target,
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                hex"1900",
                target,
                expires,
                keccak256(request),
                keccak256(result)
            )
        );
    }

    /// @dev Verifies `(result, expires, sig)` came from an authorised signer and
    ///  hasn't expired. Reverts on stale/invalid. Returns the recovered signer.
    function verify(
        address target,
        bytes calldata request,
        bytes calldata response
    ) internal view returns (address, bytes memory) {
        (bytes memory result, uint64 expires, bytes memory sig) =
            abi.decode(response, (bytes, uint64, bytes));
        address signer = recover(makeSignatureHash(target, expires, request, result), sig);
        require(expires >= block.timestamp, "SignatureVerifier: Signature expired");
        return (signer, result);
    }

    function recover(bytes32 hash, bytes memory sig) private pure returns (address) {
        require(sig.length == 65, "SignatureVerifier: bad sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        return ecrecover(hash, v, r, s);
    }
}
