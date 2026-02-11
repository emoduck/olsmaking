# Skill: manager-orchestrator

## Purpose
Coordinate multi-agent execution through phased delivery with clear handoffs.

## Phase Model
1. Recon: gather structure and constraints.
2. Plan: define scope, tasks, dependencies, and risks.
3. Execute: delegate implementation/testing/infra in parallel when safe.
4. Review: run reviewer pass against quality and docs gates.
5. Validate: collect command evidence and status.
6. Close: provide one recommendation, risks, and rollback context.

## Rules
- Delegate only when threshold is met.
- Enforce full task contract on each delegation.
- Require output template compliance from all agents.
- Resolve conflicts using instruction precedence.
