# Hizb read status and reading ahead

**Goal:** Clearly show saved reading status and allow users to open and complete upcoming personal assignments.

**Design:** Keep the existing date-based rotation and assignment IDs. Expose the next planDays days for the active enrollment as a separate upcoming list. Save early completions through the existing reader; group coverage remains tied to the assignment date. Show an explicit read/not-read status in the overview and reader, with a separate reopen action.

**Implementation:**
1. Add failing database tests for future assignment generation, completion, rollover, ownership, repetition validation, expiry and departure. Add overview tests for upcoming navigation and saved status.
2. Extend `apps/server/src/services/hizbReading.service.ts` to materialize a bounded upcoming window, return it separately from history, and allow active future assignments. Remove unused future commitments when enrollment ends, retaining completed readings.
3. Extend `apps/web/src/api/hizbReading.api.ts`, the group overview and assignment reader. Use existing mutations and cache invalidation. Add Dutch, Turkish and English labels.
4. Run focused tests, workspace type checks and lint. Inspect the final diff, preserving the existing uncommitted changes.

**Validation:** `pnpm --filter @cuzhane/server test test/services/hizbReading.service.test.ts`; `pnpm --filter @cuzhane/web test src/screens/Groups/HizbPlanGroup.test.ts`; workspace test and type checks as appropriate.
