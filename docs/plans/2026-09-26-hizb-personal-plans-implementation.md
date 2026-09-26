# Hizb personal plans implementation plan

**Goal:** Deliver unlimited fixed-plan and mixed-plan Hizb groups with individual daily assignments, catch-up, and configurable inactivity removal.

**Architecture:** Add versioned plan manifests and personal enrollment/assignment records to existing groups. Reuse membership, privacy, invitation and administrative controls; isolate the legacy shared-board endpoints from personal assignments. Preserve existing groups and history.

**Tech stack:** Existing Prisma/PostgreSQL, Express/Zod, Expo React Native, TanStack Query and Vitest.

1. Add failing content and rotation tests. Introduce identical versioned 7/15/33 manifests on server and client, verify source boundaries and mixed-plan coverage. Use the approved 15-day Hulasat boundary (section 16, block 16).
2. Add enrollment/assignment Prisma models and an additive migration. Test daily rotation, more members than portions, duplicate and concurrent joins, missed days, catch-up, Sekine ownership/revisions, inactivity cutoff, rejoining and privacy against the test database.
3. Implement the transaction-locked personal-plan service and authenticated endpoints. Integrate creation, membership, leaving, account deletion and compatibility guards. Keep existing groups' legacy history unchanged.
4. Add fixed/mixed plan and inactivity controls to the create sheet, a personal/group progress screen, enrollment and rejoin choices, and a bounded reader with saved position and repetition progress. Integrate invitations and group/Home cards. Add TR/EN/NL copy.
5. Run server and client tests, types, lint, and a client export/build. Review the final diff and address regressions. Document any remaining source limitation without inventing religious text.

Validation commands: `pnpm db:up`, `pnpm --filter @cuzhane/server test`, `pnpm --filter @cuzhane/web test`, `pnpm check-types`, `pnpm lint`. Prisma client: `pnpm --filter @cuzhane/server db:generate`. Test global setup applies migrations only to its guarded test database.

## Verification

- Full workspace tests: 774 passed (473 client, 301 server).
- Workspace type checks and lint passed.
- Expo web export passed.
- Database migrations were applied to the guarded local test database for integration tests and to the verified localhost development database.
- No production deployment or authenticated device smoke test was performed.
- The existing digital source still lacks Amenerrasulu; no substitute text was invented.
