# Cost Baseline (F1-first)

## Policy
- Default Azure hosting target: App Service.
- Default tier for all environments (including production): F1 where feasible.
- Do not propose tier upgrades by default.

## Constraints to Expect on F1
- Limited compute/performance and tighter quotas.
- Feature limitations compared with paid tiers.
- Potential reliability/perf variability under load.

## Required Behavior Under Constraints
- Prefer graceful degradation over tier upgrades.
- Document tradeoffs when a requirement cannot be fully met on F1.
- Escalate only when a tier upgrade is the last practical option.

## Escalation Trigger for Tier Upgrade Proposals
- Security/compliance requirements cannot be met on F1.
- A critical availability requirement cannot be met through degradation.
- A blocking platform capability is unavailable on F1.

Any upgrade proposal must include expected monthly impact, alternatives attempted, and rollback path.
