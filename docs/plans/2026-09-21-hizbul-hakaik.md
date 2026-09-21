# Hizbul Hakaik implementation plan

**Goal:** Stable append-only memberships and independently completed reading cycles, using the existing Hizbul Hakaik sections.

**Architecture:** Add ReadingGroup, ReadingMembership, ReadingCycle and ReadingAssignment alongside Cevşen. Reuse authentication, API wrapper, calendar helpers, invite codes, UI and reader. Do not migrate Cevşen into these tables: its shared single-read board, reusable seats and reset semantics conflict with independent personal assignments.

**Stack:** Express, Prisma/PostgreSQL, Expo React Native, TanStack Query, Vitest.

## Decisions and mathematical contract

-   A versioned content manifest references each existing section, with no copied reading text. P is the manifest length; math is generic for any positive integer P.
-   I = 1. Assignment ordinal j has part (O + joinedStep + j) mod P. Since addition by 1 is a permutation of residues, every consecutive P assignments visits all P parts exactly once.
-   Group time is a separate calendar phase, divided into P steps per weekly or calendar-month interval. Membership participation and personal cycle scheduling begin at join time. Calendar-month boundaries clamp to the anchor day (January 31 -> February 28 -> March 31), in the group's immutable timezone.
-   A personal cycle plans P distinct assignments at evenly spaced instants across its calendar interval. Only due assignments are materialized and visible, together with the next scheduled time; future work cannot be completed early. Due assignments persist until explicitly completed. No next cycle exists until all P are completed and the interval has ended. If completion is late, the next cycle begins when the previous cycle was completed. This necessarily sacrifices calendar phase alignment after missed readings; fixed absolute phase, arbitrary missed work, and no repetition before completion cannot all hold simultaneously.
-   New member offset: minimize current part occupancy, maximize minimum circular distance to occupied parts, then choose smallest part index. Convert the selected current part to O = mod(part - groupStep, P). Existing offsets never change. This is an online farthest-point heuristic, not a claim of globally optimal spacing for an unknown future member count. From an empty group with aligned progress, occupancy differs by at most one; arbitrary departures can leave unavoidable imbalance.
-   All membership allocation, lazy materialization, leaving and completing lock the ReadingGroup row first. A monotonic counter plus unique (groupId, joinSequence) and a partial unique active-membership index protect concurrency. Rejoin creates a new membership. Owner may leave without deleting the group; invite-code joining remains possible even when all members left.
-   One assignment's nullable completedAt is the idempotent completion record. Personal totals count completed ReadingCycles. Group totals count completed assignments including departed members. Progress queries never count scheduled/pending work as complete.

## Tasks

1. Add failing pure rotation and calendar tests for required P/M combinations, spacing, coverage, traversal and DST/month boundaries; implement helpers.
2. Add additive schema and SQL migration, content-reference manifest and drift check. Generate Prisma client.
3. Add integration tests for joins, departures, rejoining, concurrent joins/completions, late/missed readings, new cycles, authorization and Cevşen isolation. Implement service using row locks and immutable assignments.
4. Wire authenticated validated API endpoints, including historical access for former members and late completion of their existing assignments. Add account deletion cleanup consistent with existing policy.
5. Add localized group list/create/join/detail UI, pending and scheduled readings, personal cycle/history, collective progress, stable member order, invite sharing and leave. Connect assignment to the existing section reader and explicit completion.
6. Run database integration suites, existing server/client regressions, typechecks, lint and production server build. Inspect the final diff and document deployment and any verification limits.

## Risks

-   Migration must deploy before clients use the new endpoints. No existing tables or Cevşen enums change.
-   Section sizes differ substantially; this first content plan preserves source section boundaries rather than inventing a new division. Cadence and P remain independent.
-   Content reordering must produce a new manifest version; existing groups must retain the old content mapping.
-   Weekly/monthly means one complete personal traversal in that duration (unless the user clarifies otherwise). Completion can extend it; missed work is never auto-completed.

## Delivery and verification

-   Entry points: Groups → Hizbul Hakaik groups, and the Hizbul Hakaik contents screen. Creating a group begins its first member's cycle immediately; invitation codes append other members at any time. Former memberships remain accessible in the group list.
-   The confirmed schedule is one complete personal reading per week/calendar month. The current plan references all 17 existing sections. No original content was reconstructed or edited by this change.
-   161 server tests and 208 client tests passed, including all existing Cevşen tests. New tests exercise arbitrary part counts, lifecycle invariants, actual PostgreSQL concurrency, calendar boundaries, HTTP authentication/authorization, source-manifest agreement and reader bounds.
-   Server/client type checks and lint passed. Production server compilation and Expo web export passed. The web export was written outside the repository at `/tmp/cuzhane-hizb-web`.
-   Migration `20260921170000_reading_rotation` was applied to the isolated test database and the configured localhost development database. For deployment, run the existing `pnpm --filter @cuzhane/server db:deploy` and `db:generate` steps before starting the updated server; no remote deployment was performed.
-   The existing integration-test setup now resolves its working directory with `fileURLToPath`, which allows the test runner to operate in this workspace's path containing spaces.
-   The native simulator was inspected but showed an existing data-loading error before reaching the new feature. A complete native UI walkthrough was not performed. No production authentication bypass was added.
-   A second reviewer found no blocking rotation/concurrency defects. Its performance suggestion was addressed: member summaries load only the latest assignment; full personal history is loaded only for the viewer.
