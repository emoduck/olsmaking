# Playbook: Feature Delivery

## When to Use
For net-new user-visible capabilities, workflow changes, or API behavior changes.

## Steps
1. Create/update `docs/dev/<feature>.md` from template.
2. Run recon and identify dependencies/blockers.
3. Delegate implementation, testing, and infra work as needed.
4. Run reviewer pass and docs gate checks.
5. Run validation matrix commands and capture evidence.
6. Return recommendation, risks, and rollback notes.

## Copy-Ready Delegation Prompt Starter
Use the contract in `.opencode/skills/delegation-contract.md`.
