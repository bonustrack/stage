// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./SignatureVerifier.sol";

interface IExtendedResolver {
    function resolve(bytes memory name, bytes memory data) external view returns (bytes memory);
}

interface ISupportsInterface {
    function supportsInterface(bytes4 interfaceID) external pure returns (bool);
}

/// @title OffchainResolver
/// @notice ENSIP-10 wildcard + EIP-3668 (CCIP-Read) resolver for *.stage.eth.
///  Deployed on Ethereum mainnet. Set this contract as the resolver of
///  `stage.eth` in the ENS manager (app.ens.domains) and EVERY subdomain
///  (`alice.stage.eth`, ...) resolves through the gateway via wildcard
///  resolution. The `stage.eth` parent's own records (addr/text) are unaffected
///  unless explicitly set; only unset subnames fall through to the gateway.
///
///  Faithful port of ensdomains/offchain-resolver's OffchainResolver, trimmed to
///  what Stage needs. `url` is the gateway endpoint (the cloudflared tunnel host,
///  e.g. https://usernames.stage.eth/{sender}/{data}.json). `signers` are the
///  authorised gateway signing addresses.
contract OffchainResolver is IExtendedResolver, ISupportsInterface {
    string public url;
    mapping(address => bool) public signers;
    address public owner;

    event NewSigners(address[] signers);
    event NewUrl(string url);

    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    constructor(string memory _url, address[] memory _signers) {
        owner = msg.sender;
        url = _url;
        emit NewUrl(_url);
        for (uint256 i = 0; i < _signers.length; i++) signers[_signers[i]] = true;
        emit NewSigners(_signers);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setUrl(string calldata _url) external onlyOwner {
        url = _url;
        emit NewUrl(_url);
    }

    function setSigner(address signer, bool ok) external onlyOwner {
        signers[signer] = ok;
        address[] memory s = new address[](1);
        s[0] = signer;
        emit NewSigners(s);
    }

    /// @dev The gateway service signature the off-chain endpoint answers.
    function makeSignatureHash(
        address target,
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) external pure returns (bytes32) {
        return SignatureVerifier.makeSignatureHash(target, expires, request, result);
    }

    /// @notice ENSIP-10 entrypoint. Always reverts with OffchainLookup so the
    ///  client fetches `url` then re-enters via {resolveWithProof}.
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        override
        returns (bytes memory)
    {
        bytes memory callData = abi.encodeWithSelector(
            IResolverService.resolve.selector,
            name,
            data
        );
        string[] memory urls = new string[](1);
        urls[0] = url;
        revert OffchainLookup(
            address(this),
            urls,
            callData,
            OffchainResolver.resolveWithProof.selector,
            callData
        );
    }

    /// @notice CCIP-Read callback. Verifies the gateway signature and returns the
    ///  resolved record bytes.
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (address signer, bytes memory result) =
            SignatureVerifier.verify(address(this), extraData, response);
        require(signers[signer], "OffchainResolver: invalid signer");
        return result;
    }

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == type(IExtendedResolver).interfaceId ||
            interfaceID == type(ISupportsInterface).interfaceId;
    }
}

interface IResolverService {
    function resolve(bytes memory name, bytes memory data)
        external
        view
        returns (bytes memory result, uint64 expires, bytes memory sig);
}
