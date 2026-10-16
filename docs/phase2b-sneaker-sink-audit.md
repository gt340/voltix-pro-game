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
