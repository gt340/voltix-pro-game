# Phase 2B.1B — Sneaker Sink Write-Path Audit

Status: AUDIT COMPLETE / IMPLEMENTATION BLOCKED ON SERVER-AUTHORITATIVE GAMEPLAY DESIGN

Scope: `phase2b/firestore-hardening` only. No merge, deployment, Production configuration change, or Production Firestore write was performed.

## Verified client write paths in the primary game's `sneaker.html`

| Operation | Current client behavior | Security assessment |
|---|---|---|
| Spend solo drop coin | Locally decrements the displayed balance and asynchronously decrements Firestore | Not atomic with a game attempt; UI and persisted state can diverge |
| Score / prize points | Browser calculates hit and writes `sinkPts`, `sinkGems`, and `sinkTotal` | Browser is attacker-controlled; outcome cannot be trusted |
| Upgrade Power / Aim | Browser computes cost and writes gems and upgrade fields | Cost/cap enforced only in client code |
| Solo leaderboard | Browser increments arbitrary points | Inflatable by modified clients unless writes move behind trusted server logic |
| Prize claim | Browser submits winner record and resets points based on its own score | No server-verified threshold or robust duplicate-claim protection |
| Online race score | Participants write their own score/drop fields | Field ownership is not validation of score increments or outcomes |
| Race fees / rewards | Browser charges join/loss fees and awards winner credit | Non-atomic, client-decided settlement |
| Race completion | Host client writes finished status and winner | Host can submit a false result |

## Required implementation design

1. Verify Firebase ID tokens on every privileged API request and derive UID only from the verified token.
2. Use Firestore transactions and server-generated operation IDs for atomic, idempotent spending, upgrades, settlement, and claims.
3. Move coin spending and upgrade calculations server-side; enforce balance and upgrade caps in trusted code.
4. Do not trust client-supplied scores, hit types, winners, prize names, or gem awards.
5. Define a reproducible shot protocol and server-side outcome calculation before restoring score/reward writes. Until parity and anti-replay tests exist, keep protected score/reward writes blocked.
6. Settle multiplayer results once from server-validated state; client ownership rules alone are insufficient.
7. Prevent browsers from inventing winner records or claiming the same prize repeatedly.
8. Test forged values, UID spoofing, replay, concurrent spending, insufficient balance, upgrade caps/costs, duplicate claims, and conflicting settlement.

## Release gates

- Unit and Firestore emulator tests green.
- Client no longer mutates protected economy, score, leaderboard, winner, or match-result fields.
- Negative tests reject forged values and duplicate requests.
- Manual mobile test against non-production/staging Firebase.
- Commander review of exact diff and evidence.

## Conclusion

The current rules are safer, but Sneaker Sink is not release-ready. The next implementation must move the complete game-state trust boundary to a server-authoritative design; do not weaken Firestore rules or create an API that trusts client-reported outcomes.

## Implementation progress — 2026-10-16

- Added an authenticated `POST /api/sneaker-action` endpoint. It verifies the Firebase ID token and uses the token UID rather than a body-supplied UID.
- Added transactional, idempotent server actions for `spendDrop`, `upgradePower`, and `upgradeAim`. Costs and caps are calculated server-side.
- Rewired the primary `sneaker.html` client to use the endpoint for solo coin spending and upgrades. The request retries with the same operation ID after a network failure.
- Tightened both repositories' Firestore rules: clients cannot change `sinkPts`, `sinkGems`, `sinkPower`, `sinkAim`, or `sinkTotal`; cannot seed new user documents with forged initial values for those fields; cannot write `sinkLeaderboard`; and cannot create `winners` documents.
- Blocked client score/drop writes for Sneaker Sink online match documents. Online races and prize/scoring persistence are temporarily disabled in the primary client until trusted shot simulation and settlement are implemented.
- Added unit and emulator tests for action transactions, replay protection, upgrade costs/caps, forged score/economy writes, prize forgery, and Sneaker Sink match score forgery.

CI for the latest commits is still running; do not call these changes test-passed until the latest workflow runs finish green. This is not release-ready: shot simulation, score/gem awards, leaderboard updates, prize eligibility/claims, and authoritative multiplayer settlement remain unfinished. No merge or deployment was performed.

## Cross-game win-counter hardening

A further audit found that Foosball, Ludo, Damii and Kaisa clients increment user win counters and leaderboard documents directly. Since browser-computed results are not authoritative, the isolated rules now also deny client writes to `wins`, `ludoWins`, `damiiWins`, `kaisaWins`, and the public scoreboards. New user documents cannot seed those counters with non-zero values. Emulator coverage was expanded to test owner-side forgery attempts. Until server-side result validation is implemented, persistent win/leaderboard credit is intentionally fail-closed; this may mean current clients display a local win but cannot persist the leaderboard result.

## Remaining release blockers after the latest audit pass

- Multiplayer match documents for Foosball, Kaisa, Damii and Ludo still permit participants to submit their own score/drop fields. Field ownership is not proof of a valid match result; those games need trusted result settlement and duplicate-settlement protection before release.
- Spin & Win calls the separately hosted `spin-backend-delta.vercel.app` service. Its backend source is not in this repository, so this branch's rules audit does not establish that spin outcomes, wallet credits, referral bonuses, or prize fulfillment are safe. Audit that backend separately before claiming Spin & Win is secured.
- Server-authoritative solo Sneaker Sink shot simulation and prize eligibility remain unfinished. Current scoring persistence is intentionally disabled.
