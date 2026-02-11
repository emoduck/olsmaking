# ADR-004: Persistence with Azure SQL + EF Core + LocalDB

## Status
Accepted

## Context
Olsmaking needs durable storage for users, events, participants, beers, and reviews. The repository cost posture is F1-first and prefers low operational complexity. We also need a local development database that works well with current .NET workflows.

Requirements shaping the decision:
- Hosted relational persistence in Azure at the lowest practical cost.
- Local development database for fast iteration.
- Enforce relational constraints for event membership and one-review-per-user-per-beer-per-event.
- Support schema evolution via code-first migrations.

## Decision
Use SQL Server-compatible persistence with EF Core and environment-specific targets:
- Hosted environments: Azure SQL Database on the lowest practical MVP tier.
- Local development: SQL Server LocalDB.

Policy details:
- Use EF Core SQL Server provider and migrations as the schema source of truth.
- Persist identity and domain entities: `AppUser`, `Event`, `EventParticipant`, `EventBeer`, `BeerReview`.
- Enforce key constraints:
  - Unique `AppUser.auth0Subject`
  - Unique `EventParticipant(eventId, userId)`
  - Unique `BeerReview(eventId, beerId, userId)`
- Use optimistic concurrency (`rowversion`) on mutable entities like reviews.
- Normalize nullable text fields to `null` when input is empty/whitespace-only.

## Consequences

### Positive
- Strong relational integrity for ownership, membership, and review rules.
- Familiar toolchain for .NET teams using EF Core migrations.
- Cost-aligned hosted database path for MVP.
- LocalDB offers straightforward local setup on Windows development machines.

### Negative
- Azure SQL pricing/performance limits may constrain growth and require tier review.
- LocalDB is Windows-centric and may require alternatives for cross-platform contributors.
- Requires careful migration discipline across environments.

## Alternatives Considered
- SQLite for all environments: lower ops complexity, but weaker production fit for concurrent hosted workloads and SQL Server parity.
- Azure Cosmos DB: flexible model, but more complexity for relational constraints and query semantics needed by event membership.
- PostgreSQL on Azure: viable, but adds divergence from SQL Server/LocalDB local development choice.

## Cost / Operational Impact
- Cost posture impact: low-to-medium; starts at minimal Azure SQL tier, with explicit review before any upgrade.
- Operational complexity impact: medium; includes migration management and environment-specific connection configuration.

## Rollback / Exit Strategy
If Azure SQL/LocalDB no longer fits:
1. Keep EF Core domain model and migration history as baseline.
2. Introduce alternative EF provider target (for example PostgreSQL).
3. Migrate schema/data with controlled transition scripts.
4. Update infrastructure and app configuration while preserving API contracts.
