# Flexible groups, member privacy, and late reading

**Goal:** Allow catch-up reading with a clear lateness notice, anonymous group participation, and open flexible groups people can freely join and leave.

**Architecture:** Preserve the existing append-only catch-up endpoint. Add a group-level `hideMemberNames` setting enforced by server response shaping and notification delivery. Add a distinct `FLEXIBLE` split mode with unlimited membership and voluntary portions, preserving existing fixed and rotating groups and their seat arithmetic.

**Tech stack:** Expo React Native, TypeScript, Express, Prisma/PostgreSQL, Vitest.

## Decisions

-   Existing private visibility hides the group from discovery; member-name privacy is a separate setting. Members see anonymous labels and no profile photos or real identifiers for others; owners retain management access. Notification activity is anonymous when the setting is enabled, including already-stored inbox events.
-   Catch-up remains available from missed rounds. Show the number of calendar days late in the group's timezone. Marking a missed portion records that historical round only.
-   Flexible groups are public and always open to joining, start immediately, have no assigned daily share or member cap, and expose unread portions for voluntary reading. Leaving releases unread claims while preserving completed reads. Owner departure transfers ownership when other members remain; an empty group stays open and its next joiner becomes owner.
-   Existing fixed and rotating groups retain their present behavior.

## Implementation and verification

1. Late reading: add tests for deadline boundaries, multiple days, timezone and DST, then add a shared localized notice to both readers and round catch-up actions. Keep the historical write path unchanged.
2. Privacy: add a default-false schema field and migration, create/update validation, response shaping for detail/membership/invites/history/babs, and anonymous inbox/push rendering. Add creation and owner-setting controls in all supported languages. Test members, owner management, invite previews, historical reads, and notification changes after enabling privacy.
3. Flexible participation: extend mode validation and serializers, implement unlimited join and voluntary claim/read authorization, preserve history on leaving, and transfer ownership. Add creation, discovery/preview, and group reading controls. Test membership above normal capacity, concurrent claims, leaving, rollover, and unchanged ordinary-group behavior.
4. Run targeted tests during each change, then the full server and client suites, type checks, lint, formatting, and an independent spec/quality review. Inspect the UI if a local preview is available.

All work stays in the existing feature checkout. Unrelated untracked reference files remain untouched. Changes are prepared locally; deployment is outside this task.

## Server verification

-   266 tests pass, including calendar/DST lateness, anonymity across response endpoints, concurrent privacy changes and notification insertion, 107-member flexible groups, competing claims, departure and ownership transfer, rollover, and the Hizb repetition requirement.
-   Production build, source/test type checks, and lint pass.
-   Both additive migrations applied to the local development database (`localhost:5433/cuzhane`); production deployment remains outside this task.

## Client verification

-   All 465 web tests pass; full type checking, lint, and whitespace checks pass.
-   Expo production web export succeeds with both reading types and EN/TR/NL copy.
-   Independent review passes after fixing flexible-group entry from Home, completed portions after a reader leaves, pool refresh, and explicit public visibility during creation. Privacy guards cover previously cached member names and photos; inbox data refreshes on focus and while visible.
-   Native iOS/Android device walkthroughs were not performed.
