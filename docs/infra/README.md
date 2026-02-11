# docs/infra

This directory documents Azure hosting and infrastructure behavior.

See `docs/infra/cost-baseline.md` for the repository pricing posture and escalation rules.

Use this folder when deployment topology, Bicep templates, environment setup, or release workflows change.

Guidelines:

1. Document intent and operational impact, not only implementation details.
2. Record environment differences explicitly (dev/test/prod).
3. Include validation steps (`bicep build`, `what-if`, deploy verification).
4. Note rollback guidance for production-impacting changes.
