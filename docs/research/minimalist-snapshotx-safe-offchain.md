# Minimalist Snapshot X: offchain signed votes + a Safe as the only onchain piece

Research exploration. Read-only; no app code changes. Goal: design the smallest possible
"Snapshot X" where votes are offchain EIP-712 signed messages (classic Snapshot style) and
the ONLY onchain component is a Gnosis Safe acting as treasury and execution target.

File references below point at `~/work/sx-monorepo` (snapshot-labs/sx-monorepo) unless noted.

## TL;DR verdict

This minimalist protocol is viable, and it already exists: it is essentially **classic
Snapshot (offchain EIP-712 votes + a hub) + SafeSnap/oSnap for execution**. The SX "X"
machinery (onchain Space contracts, onchain authenticators, onchain voting strategies, onchain
proposal/vote/execution state, storage proofs, the Starknet sequencer-as-prover) is all
**droppable** for this use case. What you keep is the offchain signing format, an offchain
hub to store and tally votes, a snapshot-block voting-power computation, and one Safe Zodiac
module to bridge the result onchain. The single real design decision is the execution bridge,
and the recommended choice is an **optimistic oracle module (oSnap/UMA or Reality.eth/SafeSnap)**
because it needs no privileged signer and no onchain signature aggregation.

## 1. What full Snapshot X actually contains, and what is required vs droppable

SX is two stacks living in one monorepo. The crucial finding is that the **offchain network is
already a near-complete implementation of the minimalist target**, and the onchain network is
the heavy "X" part we want to drop.

### Onchain SX stack (the "X" parts) - DROP all of it

- **Onchain Space contracts**: each space is a deployed contract holding proposals, vote
  counts, and config onchain. Clients in `packages/sx.js/src/clients/evm/` and
  `.../clients/starknet/`. For offchain votes there is no Space contract at all.
- **Onchain authenticators**: `packages/sx.js/src/authenticators/evm/` (`ethSig.ts`,
  `ethTx.ts`, `vanilla.ts`) and `.../authenticators/starknet/`. These prove "who is allowed to
  submit this proposal/vote to the onchain Space." Pure onchain-Space machinery. Drop.
- **Onchain voting strategies**: `packages/sx.js/src/strategies/evm/` and `.../starknet/`
  compute voting power onchain (Comp-style, ERC20 votes, Merkle whitelist, etc). Drop in favor
  of the offchain strategy resolver (see below).
- **Storage proofs / single-slot proofs**: the Starknet side proves L1 token balances into
  Starknet via storage proofs; `apps/api` indexes them and `apps/mana` (the relayer/prover,
  `apps/mana/src/eth`, `.../stark`) and `apps/sequencer` (Starknet tx sequencing) generate and
  relay them. This is the most expensive part of SX and is entirely unnecessary when voting
  power is computed offchain. Drop.
- **Onchain proposal/vote txs**: in onchain SX every vote is an L2 transaction (cheap on
  Starknet, but still a tx + relayer + fee abstraction via `apps/mana`). Drop; votes become
  signed messages.
- **Onchain execution strategies as separate deployed contracts**: SX has multiple executors
  (`packages/sx.js/src/executors/`): `avatar.ts` (Safe/Zodiac Avatar), `ethRelayer.ts` (L2->L1
  bridge of an execution hash), `axiom.ts`, `isokratia.ts`, `vanilla.ts`. The L2->L1 relayer
  executor exists only to carry an onchain-tallied result across a bridge - not needed when the
  tally is offchain. **Keep the `avatar` shape** (the Safe meta-transaction encoding) as the
  execution payload format; see `executors/avatar.ts` which ABI-encodes
  `tuple(address to, uint256 value, bytes data, uint8 operation, uint256 salt)[]` - exactly a
  Safe MultiSend batch.

### Offchain SX stack (this IS the minimalist target) - KEEP, trimmed

- **EIP-712 offchain message format**: `packages/sx.js/src/clients/offchain/ethereum-sig/`
  (`index.ts`, `types.ts`) defines the typed-data for `vote`, `propose`, `updateProposal`,
  `cancelProposal`, `followSpace`, `setAlias`, single/approval/ranked/weighted/encrypted vote
  variants. This is the classic Snapshot signing scheme. **Keep** (you can trim to just
  `propose` + one or two vote types).
- **The hub / sequencer**: `apps/sequencer/` is the offchain hub. It ingests signed envelopes
  (`src/ingestor.ts`), persists proposals and votes to MySQL (`src/scores.ts` reads
  `proposals` and `votes` tables), and finalizes scores by calling the scores API
  (`scoreAPIUrl = https://score.snapshot.org`, `src/scores.ts`). The relayer endpoint
  (`relayer.snapshot.org`) and sequencer endpoint (`seq.snapshot.org`) are referenced directly
  in `clients/offchain/ethereum-sig/index.ts`. **Keep a minimal version of this hub.**
- **Offchain voting-power strategies**: `packages/sx.js/src/strategies/offchain/`
  (`remote-vp.ts`, `remote-validate.ts`, `only-members.ts`). `remote-vp.ts` computes voting
  power by calling the remote scores API against the space strategies at the proposal snapshot
  block. **Keep** (this is how power is computed without any onchain strategy contract).
- **Execution as a proposal plugin pointing at a Safe**: in the offchain UI network adapter
  `apps/ui/src/networks/offchain/api/index.ts`, treasuries are plain space metadata
  (`space.treasuries.map(...)`, `SpaceMetadataTreasury`), and execution is read from
  `proposal.plugins.oSnap` (lines ~301-320) or `proposal.plugins.safeSnap` (~325+). Helpers:
  `apps/ui/src/helpers/osnap/transactions.ts` (UMA Optimistic Governor: encodes
  `[to, operation, value, data]`) and `apps/ui/src/helpers/safesnap/transactions.ts`
  (Reality.eth module). **This plugin-points-at-a-Safe pattern is exactly the minimalist
  execution model.** No onchain Space, no executor contract owned by the protocol - just a Safe
  with a Zodiac module.

So the minimalist SX is: take the offchain stack, trim the message types, run a tiny hub, and
attach one Safe execution module. Everything onchain except the Safe + its one module is gone.

## 2. Classic Snapshot offchain model, for contrast

Classic Snapshot is the reference design and the minimalist target converges on it:

- A voter signs an EIP-712 typed-data `vote` message (space id, proposal id, choice, reason,
  timestamp). No transaction, no gas.
- The signed message is POSTed to a **hub** (historically `hub.snapshot.org`, in SX the
  `sequencer`/`relayer`). The hub validates the signature, checks the voter had voting power at
  the proposal's snapshot block (via the scores API + the space's strategies), stores the vote,
  and pins/relays it (IPFS historically).
- Tally is computed offchain by summing voting power per choice (`apps/sequencer/src/scores.ts`
  computes and finalizes scores after a delay; `FINALIZE_SCORE_SECONDS_DELAY = 60`).
- The result is just data sitting in the hub DB + IPFS. By itself it triggers nothing onchain.

Historically the bridge from "offchain result" to "Safe executes a tx" is **SafeSnap**
(Reality.eth Zodiac module) and later **oSnap** (UMA Optimistic Governor Zodiac module). Both
are optimistic: the result is asserted onchain, a bonded challenge window opens, and if nobody
disputes, anyone can execute the batch on the Safe.

Trust model of the offchain->Safe handoff: the offchain vote and tally are NOT cryptographically
proven onchain. An assertion ("proposal P passed and authorizes batch B") is posted onchain with
a bond. The optimistic oracle does not re-run the vote; it relies on **economic dispute**:
honest watchers dispute false assertions and win the bond. Correctness is enforced by incentives
plus a final-arbiter vote (UMA token holders for oSnap, Reality.eth escalation game / optional
Kleros arbitration for SafeSnap), not by math.

## 3. The Safe-as-treasury/execution piece, three options

All three put a Safe at the center as treasury + execution. They differ in how the offchain
tally is authorized to move the Safe.

### Option A - Optimistic oracle module (oSnap / UMA, or SafeSnap / Reality.eth) [RECOMMENDED]

- A Zodiac module is enabled on the Safe (UMA Optimistic Governor, or
  `gnosisguild/zodiac-module-reality`).
- After the offchain vote closes, anyone posts the transaction batch onchain with a bond and a
  reference to the passed proposal. A challenge window opens (e.g. 24-72h). If undisputed, anyone
  executes the batch via the module on the Safe. If disputed, a final arbiter resolves (UMA
  token vote / Reality.eth escalation game, optionally Kleros).
- **Trust**: no privileged signer; security is economic (bond size + at least one honest,
  funded watcher) plus the arbiter. Already audited, deployed, and supported in the SX UI
  (`helpers/osnap`, `helpers/safesnap`).
- **Cost**: gas for the assertion + the execution (and the proposer's bond, refunded if honest).
  No protocol contract to deploy or maintain beyond enabling a standard Zodiac module.

### Option B - Onchain-verified aggregated signatures (a custom Safe module)

- A bespoke Safe module verifies the actual votes onchain: it is handed the set of EIP-712 vote
  signatures (or an aggregate / Merkle root of them) plus each voter's voting power proof at the
  snapshot block, recomputes the tally onchain, and executes if quorum/majority passed.
- **Trust**: trust-minimized in the strongest sense - the Safe itself verifies the real votes,
  no oracle, no bond, no privileged signer. But voting-power-at-block must be proven onchain,
  which reintroduces exactly the storage-proof / onchain-strategy complexity SX uses
  (`apps/mana`, EVM strategies). Aggregating N signatures onchain is also gas-heavy unless you
  use a SNARK (Isokratia-style, see `executors/isokratia.ts`) or BLS aggregation.
- **Cost**: high engineering cost (new audited module + proof system); high or moderate gas.
  This is "rebuilding part of SX," which defeats the minimalism goal.

### Option C - Trusted relayer / Safe owners rubber-stamp

- The offchain result is computed by the hub; either a trusted relayer key (or the Safe's own
  owners as a small multisig) simply submits the corresponding Safe tx. The vote is advisory and
  a human/relayer enacts it.
- **Trust**: fully trusted - the relayer or signers can ignore or fake results. Censorship and
  outcome-substitution are unmitigated. This is what most DAOs actually do today (Snapshot vote,
  then multisig executes), and it is the cheapest and simplest.
- **Cost**: near zero beyond normal Safe gas. Zero new contracts.

### Comparison

| Option | New onchain code | Trust assumption | Gas | Eng effort |
|---|---|---|---|---|
| A optimistic oracle | none (standard Zodiac module) | bond + 1 honest watcher + arbiter | medium | low |
| B verified aggregate sigs | custom audited module + power proofs | cryptographic, trustless | high | high |
| C trusted relayer / signers | none | trust the relayer/owners | low | minimal |

## 4. The minimalist protocol design

### Vote casting
- Voters sign EIP-712 typed-data votes (reuse `clients/offchain/ethereum-sig` types, trimmed to
  `propose` + a single vote type to start). Gasless.
- Voting power is taken at a **snapshot block** fixed at proposal creation, computed offchain
  via the space strategies (token balance, ERC20-votes, or a Merkle/allowlist), reusing
  `strategies/offchain/remote-vp.ts` against a scores API. No onchain strategy contracts.

### Storage / aggregation of votes
Two tenable choices:
- **Lightweight hub (recommended)**: a trimmed `apps/sequencer` - an HTTP endpoint that
  validates the signature, checks power at the snapshot block, stores `{proposal, votes}` in a
  small DB (SQLite/Postgres is fine; SX uses MySQL via `apps/sequencer/src/scores.ts`), and
  mirrors signed envelopes to IPFS for data availability. Computes the tally after close.
- **Fully client-side + IPFS/feed**: no server; votes are published to a content-addressed feed
  (IPFS/Arweave or even an XMTP/append-only log) and any client tallies independently. Maximal
  decentralization, but you lose easy spam-filtering, ordering, dedup, and a canonical tally; a
  hub is the pragmatic default.

### Result -> execution
- On close, the hub finalizes the tally (cf. `apps/sequencer/src/scores.ts`,
  `FINALIZE_SCORE_SECONDS_DELAY`).
- The proposal carries an execution payload in the **avatar/Safe MultiSend shape**
  (`executors/avatar.ts`: `tuple(to,value,data,operation,salt)[]`).
- Bridge to the Safe via **Option A** (oSnap or SafeSnap Zodiac module): post the batch +
  proposal reference with a bond, wait out the challenge window, then anyone executes. The Safe
  is the treasury and the execution target; the module is the only protocol-specific onchain
  artifact, and it is an off-the-shelf audited Zodiac module.

### Minimal stack summary
EIP-712 signed votes -> tiny hub (validate power at snapshot block, store + IPFS, tally) -> Safe
+ one optimistic-oracle Zodiac module (oSnap/SafeSnap) for execution. Nothing else onchain.

## 5. What you DROP vs full SX, and what you MUST keep

DROP: onchain Space contracts; all onchain authenticators; all onchain voting strategies; vote
transactions; storage/single-slot proofs and the prover/sequencer that generate them
(`apps/mana`, Starknet `apps/sequencer`); the L2->L1 relayer executor (`executors/ethRelayer.ts`)
and the indexer of onchain state (`apps/api` for onchain spaces); fee abstraction. The entire
Starknet side.

KEEP: the EIP-712 offchain signing scheme (`clients/offchain`); a minimal offchain hub to
validate, store, and tally (trimmed `apps/sequencer`); offchain voting-power resolution at a
snapshot block (`strategies/offchain/remote-vp.ts` + a scores API); the Safe MultiSend execution
payload shape (`executors/avatar.ts`); one Safe Zodiac execution module (oSnap or SafeSnap).

## 6. Security and trust analysis

- **Who can cheat at the bridge**: under Option A, a proposer can assert a false result; the
  only defense is a bonded dispute by an honest, funded watcher within the window, plus the
  arbiter (UMA vote / Reality escalation). If no honest watcher disputes in time, a false batch
  executes. So liveness of watchers and adequate bond sizing are the live risks. Under Option C
  the relayer/signers can cheat freely. Option B removes this entirely at high cost.
- **Censorship**: the hub can drop or reorder votes (it sees them before tally). Mitigate with
  IPFS mirroring of signed envelopes so any party can independently recompute the tally and
  detect omission; signatures are self-authenticating, so a censored-but-published vote is
  provable. A fully client-side feed removes the hub as a censor but adds DA/coordination cost.
- **Data availability of votes**: votes live offchain. If the hub DB is lost and envelopes were
  not mirrored, the tally is unverifiable after the fact. MUST pin signed envelopes to IPFS/
  Arweave. The execution bridge only consumes the final assertion, so DA of individual votes is
  a transparency/auditing concern, not an execution blocker, under Options A/C; it IS load-
  bearing under Option B.
- **Finality**: offchain tally is "final" only socially until the bridge asserts and the
  challenge window elapses. Real onchain finality is the Safe execution tx. Add a timelock via
  the module's challenge window.
- **Sybil / voting-power verification offchain**: power is computed by the hub from the space
  strategies at the snapshot block. A malicious or buggy hub can misreport power. Because power
  derivation is deterministic from public chain state + published strategies, anyone can
  recompute and challenge - but ONLY if the inputs (strategies, snapshot block, voter set) are
  published. So publish strategies + snapshot block in the proposal and mirror the voter set.
  Token-weighted voting inherits the usual plutocracy/flash-loan-at-snapshot caveats; pin the
  snapshot to a past block to blunt flash-loan attacks.
- **Net trust model**: this is NOT trustless like onchain SX. Options A/C trust either an
  economic game + arbiter or a relayer. That is an accepted, widely-deployed tradeoff (most DAO
  treasuries run exactly this), and it is the price of dropping all onchain protocol surface.

## 7. Verdict, recommended architecture, effort, risks

**Viable and genuinely minimal - yes.** The recommended architecture:

1. EIP-712 offchain signed votes (reuse `clients/offchain/ethereum-sig`, trimmed).
2. A small hub (trimmed `apps/sequencer`): validate signature, check power at a fixed snapshot
   block via offchain strategies + a scores API, store votes, mirror signed envelopes to IPFS,
   tally on close.
3. A Safe as treasury + execution target with **one optimistic-oracle Zodiac module**
   (oSnap/UMA recommended for the cleaner UX + no privileged signer; SafeSnap/Reality.eth as the
   battle-tested alternative). Execution payload in the avatar MultiSend shape.

**Effort**: low if you accept Option A. The hub is the only real build, and it is a heavily
trimmed fork of `apps/sequencer` (signature verify + power check + store + tally + IPFS pin). No
contracts to write or audit - the Safe and Zodiac modules are off-the-shelf. The SX UI already
renders oSnap/safeSnap execution from proposal plugins, so a frontend can be adapted rather than
built. Roughly: a few days for a minimal hub + scores integration, plus configuration of the
Safe + Zodiac module per treasury.

**Biggest risks**: (1) the optimistic bridge depends on a funded honest watcher and correct
bond sizing - under-bonded or unwatched proposals can execute a false result; (2) hub
centralization for censorship/availability - mitigate with mandatory IPFS mirroring of signed
envelopes and published strategy/snapshot inputs so the tally is independently recomputable;
(3) offchain DA - lose the envelopes and you lose auditability.

**Where this differs from "just classic Snapshot + SafeSnap"**: it essentially is that. The
only SX-specific pieces worth borrowing are (a) the cleaned-up `sx.js` offchain client/types and
strategy resolver (`strategies/offchain`), and (b) the avatar executor payload shape so the
execution batch format matches what oSnap/SafeSnap modules already accept. The expensive SX
innovations - onchain Spaces, storage proofs, the Starknet prover/sequencer, onchain vote txs -
add nothing to a Safe-treasury + offchain-vote design and should be dropped. If a future
requirement demands trustless execution with no oracle and no watcher assumption, that is when
you graduate to Option B (onchain-verified aggregated signatures), accepting the SNARK/proof and
gas cost - i.e. you start rebuilding SX. For a minimal treasury DAO, Option A is the sweet spot.

## Sources
- SafeSnap (Reality.eth): https://docs.snapshot.box/user-guides/plugins/safesnap-reality
- Zodiac Reality module: https://github.com/gnosisguild/zodiac-module-reality
- oSnap (UMA): https://docs.uma.xyz/developers/osnap/ and
  https://docs.snapshot.org/user-guides/plugins/safesnap-osnap
- SafeSnap intro: https://medium.com/gnosis-pm/introducing-safesnap-the-first-in-a-decentralized-governance-tool-suite-for-the-gnosis-safe-ea67eb95c34f
- Code: `~/work/sx-monorepo` (snapshot-labs/sx-monorepo), files cited inline above.
