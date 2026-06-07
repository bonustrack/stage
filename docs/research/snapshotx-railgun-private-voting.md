# Feasibility study: Snapshot X + Railgun for private voting

Status: research / analysis. No code changes. Read-only investigation of `~/work/sx-monorepo` (Snapshot X) and `~/work/metro/apps/app/lib/railgun` (Railgun integration), plus general Railgun and zk-voting architecture.

Question: can Snapshot X (Snapshot's onchain/modular voting system) be combined with Railgun (a shielded-balance / private-transfer privacy pool on EVM) to achieve private voting, and how?

Short answer: Railgun is the wrong tool for the privacy properties that matter in voting. It is a privacy pool for value transfer, not a general zk-app framework, and its nullifier/commitment set is bound to spending UTXOs, not to "I am eligible and have not voted." The cryptographic primitives Railgun uses (Poseidon-Merkle commitments, nullifiers, Groth16) are exactly the right primitives for private voting, but the right way to use them is a purpose-built Semaphore-style or MACI-style voting strategy inside Snapshot X, not a reuse of the Railgun engine. Snapshot X already ships an encrypted-vote path (Shutter) that hides the choice until reveal; that covers one property today. Hiding the voter and unlinking voter to vote needs new zk work regardless of whether Railgun is involved.

---

## 1. Snapshot X voting architecture (what is public, and where)

Snapshot X is modular: a Space is configured with a set of `authenticators` (how a voter proves the request is theirs), `voting strategies` (how voting power is computed), and `execution strategies`. There are three execution surfaces: offchain (signed messages to a sequencer), EVM (onchain tx), and Starknet (onchain tx, with L1 storage proofs). Key code in `packages/sx.js/src`.

### Authenticators (proving the request is yours)
- EVM: `authenticators/evm/{ethSig,ethTx,vanilla}.ts`. `ethSig` recovers an ECDSA signature and passes `v,r,s` plus the calldata to the on-chain `EthSigAuthenticator`. `ethTx` proves authorship by being `msg.sender`. `vanilla` is no-auth (testing).
- Starknet: `authenticators/starknet/{ethSig,ethTx,starkSig,starkTx,vanilla}.ts`.
- In every real authenticator the voter address is an explicit input. There is no anonymous authenticator. Identity is public by construction.

### Voting strategies (computing voting power)
`strategies/evm` and `strategies/starknet`:
- `vanilla` (1 person 1 vote), `comp` / `ozVotes` (ERC20Votes `getPastVotes` at the snapshot block), `apeGas`, and crucially:
- `merkleWhitelist.ts` (EVM + Starknet): voting power from an OpenZeppelin `StandardMerkleTree` keyed by `(address, votingPower)`. The voter supplies a Merkle proof. Note: the leaf is `(address, votingPower)`, so the proof reveals the address and the weight. This is a membership proof, but not a private one.
- Starknet has real storage-proof strategies: `strategies/starknet/evmSlotValue.ts` and `ozVotesStorageProof.ts`, backed by `utils/storage-proofs/proof.ts`. These call `eth_getProof` for a specific `(token, slotKey(voter), block)` and verify the L1 storage slot on L2 via Herodotus-style L1 headers. This proves "this voter held this balance at this block" trustlessly, but again the voter address is the slot key, so it is fully public.

### Vote casting and where privacy dies
- Offchain (the common Snapshot path): `clients/offchain/ethereum-sig/index.ts`. The voter EIP-712-signs a `Vote { from, space, proposal, choice, ... }` and POSTs it to the sequencer (`seq.snapshot.org`). The signed message contains the address, the choice, and is published. Voter, choice, and (via strategy) weight are all public.
- EVM onchain: `clients/evm/ethereum-tx/index.ts` `vote()` (around line 541) passes `voterAddress` and `envelope.data.choice` into the authenticator/space call. Public on-chain.
- Net: across all three surfaces, voter identity + choice + voting power become public at vote time (offchain: at the sequencer; onchain: in calldata/events).

### Existing privacy work in Snapshot X: Shutter encrypted voting
This is the most important existing primitive. `clients/offchain/ethereum-sig/index.ts` imports `encryptedVoteTypes` and `encryptChoices`; `clients/offchain/utils.ts` implements `encryptShutterChoice()` using `@shutter-network/shutter-crypto` against a hardcoded Shutter eon public key, keyed by `proposalId`. The `Privacy` type (`types/index.ts`) is `'shutter' | 'none'`.

What Shutter gives: the CHOICE is encrypted to a threshold key and is undecryptable until the proposal ends, when the Shutter keypers release the decryption key and the sequencer tallies. This prevents vote-buying / herding during the vote and front-running. It does NOT hide WHO voted (the signed envelope still carries `from`), and it does NOT hide the WEIGHT. So Snapshot X today solves "hide the choice in-flight," and nothing else.

---

## 2. Railgun: what it actually provides (and what it does not)

From the metro integration (`apps/app/lib/railgun`, `apps/app/nodejs-assets/nodejs-project`) and Railgun architecture:

- Railgun is a privacy POOL for ERC20/NFT value. You `shield` tokens into a Poseidon-Merkle commitment tree (a 0zk note = a UTXO commitment hiding owner + amount), `transfer` privately inside the pool, and `unshield` back to a public address. `txid version` in the integration is `V2_PoseidonMerkle` (`lib/railgun/send.ts`).
- Each spend reveals a `nullifier` (derived from the spent note) so the same note cannot be double-spent, and creates new output commitments. This is a classic commitment + nullifier UTXO scheme.
- Proofs are Groth16, generated by an embedded native prover (`lib/railgun/native.ts`, `sdkEngine.ts` `setNativeProverGroth16`, circuits loaded once). Proving an unshield/transfer takes ~10-30s on device (`send.ts` header).
- POI (Proof of Innocence): an aggregator (`sdkEngine.ts` POI_NODE_URLS) lets a note prove it does not descend from blocklisted funds, for compliance. Not relevant to voting.
- The 0zk address model: recipients are addressed by a `0zk...` viewing/spending key pair, decoupled from any EOA.

What Railgun does NOT provide:
- It is not a general zk circuit framework. You cannot ask the Railgun prover to prove an arbitrary statement like "I am in this token-holder set and have not voted." Its circuits prove one fixed statement: "I own unspent notes summing to >= outputs, here are their nullifiers and the new commitments, and balances are conserved." You cannot inject a "vote choice" or a "proposal nullifier domain" without forking the circuits.
- It proves ownership/conservation of notes IN ITS OWN POOL. It says nothing about a voter's balance of some governance token at a snapshot block on the public chain. The thing voting needs to gate on (token balance at block N) lives outside Railgun's tree.
- Its nullifier is per-note (anti double-SPEND). It is not a per-(identity, proposal) nullifier (anti double-VOTE). Reusing it would mean "you can vote once per shielded note you spend," which is not an eligibility model anyone wants.

Reusable primitives, in principle: the Poseidon-Merkle commitment tree, the nullifier concept, and Groth16 native proving infra. But these are generic zk building blocks; Railgun's specific instantiation is bound to transfers.

---

## 3. The privacy properties: which are the goal, which are feasible

Four distinct properties, often conflated:

1. Hide the CHOICE (until reveal). Achievable today via Shutter in Snapshot X. Done.
2. Hide WHO voted (anonymity of the voter within the eligible set). Achievable with new zk work (Semaphore/MACI-style), NOT with Railgun reuse.
3. Hide the WEIGHT / voting power. Hard, and partly fundamental. See below.
4. Unlinkability voter -> vote (you cannot tell which eligible member cast which ballot, even if you know the member set). This is the real "anonymous voting" property; it is achievable together with (2) via nullifier-based schemes.

The fundamental tension: voting power in token governance is derived from a PUBLIC balance at a PUBLIC snapshot block. Anyone can read every holder's balance at block N from chain state. So:
- Hiding the weight is only meaningful if eligibility is a set-membership predicate (1p1v, or "holds >= threshold," or a fixed-weight whitelist), not a continuous balance read. With per-holder continuous weight, the tally itself (sum of weights per choice) plus public balances leaks a lot; full weight privacy needs the weight to be a private witness inside the proof AND a homomorphic/encrypted tally, which is MACI/encrypted-tally territory and still leaks aggregate sums.
- Hiding the voter is feasible: prove membership in a commitment set (built from eligible addresses) without revealing which member, and emit a per-proposal nullifier to stop double-voting. This is exactly Semaphore.

Realistic target for a first deliverable: properties (1) + (2) + (4) for a membership-style strategy (1p1v or threshold or fixed-weight whitelist). Full continuous weight privacy (3) is a research-grade add-on.

---

## 4. Architecture options

### Option A: Railgun-reuse (cast a vote by moving a shielded note)
Idea: voters shield a governance token; to vote, they make a Railgun transfer / unshield whose memo or destination encodes the choice, and the per-note nullifier prevents reuse.
Verdict: does not work for voting and is not recommended.
- Railgun proves note conservation, not "balance at snapshot block." Eligibility cannot be expressed.
- The nullifier is per-note, not per-(voter, proposal): a whale with many notes votes many times; someone who shielded after the snapshot votes illegitimately; someone who never shielded cannot vote at all.
- Weight = amount in the spent note, which is not the governance weight.
- You would be paying for a 10-30s Groth16 transfer proof to get a worse, incorrect eligibility model. The only thing borrowed is the prover, which you could borrow directly.

### Option B: purpose-built zk anonymous-voting strategy in Snapshot X (Semaphore-style) RECOMMENDED
Build a new SX voting strategy + authenticator pair that uses commitments and nullifiers directly (the Railgun primitives, not the Railgun engine):
- Eligibility set: build a Merkle tree of identity commitments for eligible voters. Snapshot X already has the scaffolding for set-based strategies (`merkleWhitelist.ts`, and the Starknet storage-proof strategies that prove "held X at block N"). The eligible set can be derived from a snapshot (ERC20 holders >= threshold, or a 1p1v allowlist) and committed as `Poseidon(identityNullifier, identityTrapdoor)` Semaphore leaves.
- Casting: voter generates a zk proof "I know the secret behind a leaf in this tree AND nullifierHash = Poseidon(identityNullifier, proposalId)," reveals only the nullifierHash + the (optionally Shutter-encrypted) choice. The nullifierHash stops double-voting per proposal; nothing links it to the address.
- Authenticator: a new "anonymous" / "zkVote" authenticator that takes the proof + nullifierHash instead of an ECDSA sig. This is a clean fit for SX's pluggable authenticator interface (see the `Authenticator.createCall` shape in `authenticators/evm/ethSig.ts`).
- Properties achieved: hide WHO (2), unlinkability (4), and compose with Shutter for hide-the-CHOICE (1). Weight is 1p1v or threshold (set membership), so weight is uniform/hidden by construction (partial 3).
- This is essentially the open-source Semaphore stack (semaphore-protocol) wired as an SX strategy. The Railgun connection is conceptual reuse of the same primitives, and optionally reuse of the metro app's native Groth16 prover infra (`lib/railgun/native.ts`) to generate Semaphore proofs on device.

### Option C: MACI-style for collusion resistance
If the threat model includes vote-buying / coercion where the buyer demands proof of how you voted, Semaphore alone is insufficient (a voter can prove their own ballot). MACI (Minimal Anti-Collusion Infrastructure) adds an operator that re-encrypts/keys ballots so a voter cannot prove their final vote, with zk proofs of correct tally. This gives the strongest property set but requires a trusted-ish coordinator and a heavier tally circuit. Recommend only if collusion resistance is an explicit requirement; otherwise it is a large lift.

### Option D: storage-proof + zk wrapper (weight-preserving anonymity, research)
Combine SX's existing storage-proof strategy (`evmSlotValue.ts`, proves balance at block N) with a zk layer that hides which slot was proven. This is the path to anonymity WITH real per-holder weight, but it requires a custom circuit that verifies an MPT storage proof inside zk (expensive) plus an encrypted/homomorphic tally to avoid leaking weights. Highest value, highest cost, research-grade.

---

## 5. The hard problems (honest)

1. Weight is public by design. Governance weight = token balance at a public snapshot block. You cannot hide weight while reading it from public state; you can only hide it by switching to set-membership eligibility (1p1v / threshold) or by carrying weight as a private witness with an encrypted tally (Option D), which still leaks aggregate sums.
2. Eligibility vs double-vote are two separate predicates. You need BOTH "I am in the eligible set" (membership proof) AND "I have not already voted on THIS proposal" (per-proposal nullifier). Railgun gives only a per-note anti-double-spend nullifier, which is the wrong domain. Semaphore gives exactly the right (membership + external-nullifier) pair.
3. Tally correctness + verifiability. Once ballots are anonymous you must convince observers the tally is correct without de-anonymizing. Shutter handles encrypted-choice reveal+tally for the choice-privacy case; for voter-anonymous tallies you need either public nullifier+choice tuples (Semaphore, tally is publicly recomputable) or zk tally proofs (MACI).
4. Building the eligible-set commitment tree privately. If the tree is built from public holders, an observer knows the candidate set; anonymity is "1 of N eligible," which is fine, but the set itself is public. Registering identity commitments (Semaphore signup) per snapshot adds a UX step and an onchain or sequencer-side registry.
5. Execution onchain. SX execution strategies act on tally outcomes; an anonymous tally must still produce a verifiable result the executor accepts. Semaphore-style public nullifier+choice tuples keep this simple; MACI needs the executor to trust the coordinator's tally proof.
6. Native proving on mobile. The metro app already runs a native Groth16 prover for Railgun (`native.ts`, ~10-30s). A Semaphore proof is far lighter, so on-device proving is realistic, but it is still new wiring and circuit artifacts to bundle (cf. the Railgun circuit-artifact and APK-baking pain documented in memory).

---

## 6. Is Railgun the right tool? Comparison

| Approach | Hides voter | Unlinkable | Hides choice | Real weight | Collusion-resistant | Fit with SX | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Railgun reuse (A) | partial/incorrect | no | no | wrong weight | no | poor | wasted |
| Shutter (exists) | no | no | yes (until reveal) | n/a | partial | native | 0 (shipped) |
| Semaphore SX strategy (B) | yes | yes | yes (+Shutter) | 1p1v/threshold only | no | excellent | medium |
| MACI (C) | yes | yes | yes | yes (private witness) | yes | new subsystem | high |
| storage-proof + zk (D) | yes | yes | yes | yes | no | extends existing | research |

Railgun loses on every axis that matters for voting except "it has a Groth16 prover and a Poseidon-Merkle tree," which Semaphore also has and uses correctly. The privacy pool design is bound to value transfer; voting eligibility and double-vote prevention live in a different nullifier domain that Railgun does not expose.

---

## 7. Verdict and recommended path

Verdict: Combining Snapshot X with Railgun specifically does NOT make sense for private voting. Railgun is a transfer privacy pool, not a zk eligibility/voting framework, and its nullifier and proof semantics do not map to "eligible, unlinked, one-vote-per-proposal." It is feasible to build private voting that uses the SAME cryptographic primitives Railgun is built on, but the correct vehicle is a purpose-built zk voting strategy inside Snapshot X.

Recommended path (incremental):
1. Now (zero new crypto): document and lean on the existing Shutter encrypted-vote path for choice privacy. Already in `clients/offchain`. Covers the most common ask ("don't let people see the running tally / my choice while voting is open").
2. Next (the real win): build Option B, a Semaphore-style anonymous voting strategy + authenticator in `packages/sx.js` (new `strategies/.../semaphore.ts` + `authenticators/.../zkVote.ts`), with the eligible set committed from a snapshot (reuse the `merkleWhitelist` / storage-proof set-construction patterns). Per-proposal external nullifier for double-vote prevention; combine with Shutter for choice privacy. Optionally reuse the metro app's native Groth16 prover (`apps/app/lib/railgun/native.ts`) to generate Semaphore proofs on device.
3. Later, only if collusion resistance is required: evaluate MACI (Option C). Large lift, needs a coordinator.
4. Research track: Option D (zk-wrapped storage proofs + encrypted tally) for weight-preserving anonymity.

Rough effort:
- Option B as an offchain SX strategy + sequencer support: a few weeks of focused zk + integration work (Semaphore is off-the-shelf; the work is the SX strategy/authenticator interface, the set-registry, and the tally path). Mobile on-device proving adds the usual circuit-artifact / APK-baking overhead.
- MACI: months, plus operational coordinator infrastructure.

Biggest risks / unknowns:
- Sequencer + indexer changes: anonymous votes break the assumption that every vote has a recoverable `from`. The Snapshot sequencer/hub/api would need to accept and tally nullifier-keyed ballots. This is likely the largest non-crypto lift.
- Set construction and snapshot UX: a per-proposal Semaphore registration / identity-commitment flow is new UX and a new registry surface.
- Weight: stakeholders must accept set-membership eligibility (1p1v / threshold) to get anonymity cheaply; "anonymous AND token-weighted AND verifiable" is the research-grade corner.
- On-device proving and artifact bundling (the same class of pain already seen with Railgun circuits on the APK).

---

## Appendix: key files cited
Snapshot X (`~/work/sx-monorepo/packages/sx.js/src`):
- Authenticators: `authenticators/evm/{ethSig,ethTx,vanilla}.ts`, `authenticators/starknet/*`
- Strategies: `strategies/evm/{merkleWhitelist,comp,ozVotes,apeGas,vanilla}.ts`; `strategies/starknet/{evmSlotValue,ozVotesStorageProof,merkleWhitelist,erc20Votes}.ts`
- Storage proofs: `utils/storage-proofs/proof.ts`
- Offchain vote + privacy: `clients/offchain/ethereum-sig/index.ts`, `clients/offchain/utils.ts` (`encryptShutterChoice`), `clients/offchain/types.ts`; `Privacy` type in `types/index.ts`
- EVM onchain vote: `clients/evm/ethereum-tx/index.ts` (`vote()` ~L541)

Railgun (`~/work/metro/apps/app`):
- `lib/railgun/send.ts` (transfer flow, `V2_PoseidonMerkle`, Groth16), `lib/railgun/native.ts` (native prover), `lib/railgun/sdkEngine.ts` (POI, prover wiring), `nodejs-assets/nodejs-project/engine.js`
