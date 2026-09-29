# Hizbü'l-Hakaik Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task.

**Goal:** Implement the design "Hizbü'l-Hakaik · geliştirici paketi · 12 ekran" (HC1–HC4, HJ1–HJ3, HZ1–HZ5): Hizb groups that run on the Cevşen group model with 33 portions, a MONTHLY cycle, per-portion pool claims and a 19-repetition Sekine rule.

**Architecture:** A `Group` gains an immutable `kind` (`CEVSEN` | `HIZB`). Its part count is derived from the kind (`CEVSEN` = 100 babs, `HIZB` = 33 portions), and every piece of seat/rotation/pool/round math takes that count as an argument instead of reading `BAB_COUNT`. All of the Cevşen machinery is reused unchanged in shape: seats, ROTATION/FIXED, the lazy rollover, the pool, rounds history, covering missed parts, `BabRead`, `syncCompletedAt` and notifications. Three things are new:

- a MONTHLY cycle, anchored on the start's day of month and clamped to the month's length;
- a per-portion pool claim, used by Hizb only;
- a `GroupPartRepetition` counter that gates Sekine (portion 19) at 19.

The unreleased reading-groups feature from 21 Sep, which modelled personal cycles, is removed with a drop migration. The free Hizb reader stays.

**Tech Stack:** Express 5 + Prisma/PostgreSQL + Zod + Vitest (server); Expo React Native + TanStack Query + React Navigation + react-hook-form/zod (web).

**Decisions (confirmed by the user, 2026-09-26):**
1. **Model:** use the design's Cevşen logic, and remove the separate reading-plan model.
2. **Division:** use the revised 33-portion division from the numbered book photos, not the design's older 32. The screens draw 33 cells.
3. **Sekine ×19:** do it in this change. The server stores the count per member per round per portion, and refuses completion below 19.
4. **Hatim card** on HC1: leave it out. Only the Cevşen and Hizbü'l-Hakaik cards are shown.

**Deliberate deviations from the design (report these at the end):**
- **33 portions instead of 32.**
  - Münâcâtü'l-Kur'ân is 21–25, Tahmîdiye 26, Hulâsa 27–30 and Tazarru ve Niyaz 31–33.
  - The grids are 11 columns × 3 rows. The design's 8 × 4 does not tile 33.
- **Four create steps for both kinds:** type → define → seats & plan → cycle.
  - HC3 draws Süre on step 3. Here it stays on its own final step, as the Cevşen flow already does, so "Adım n / 4" holds for both kinds and the fixed-height sheet keeps one structure.
- **The sheet, not a page.** Create-group stays the platform sheet (CLAUDE.md: bottom sheets), not the full-page frames the prototype draws.
- **App conventions for the reader.** The design has no reader frame, so the Hizb portion reader follows the Cevşen reader's conventions: E2 ownership chip, hint and a gated Okudum.

**Open content questions to surface, not resolve** (from `docs/plans/2026-09-26-hizbul-hakaik-rotation-review.md`):
- Âmenerresûlü is not in the digital text, so portion 3 has none.
- The Cevşen starts follow the reading "next bab after the marked refrain": 21, 42, 62 and 82.

**Conventions to obey** (CLAUDE.md):
- Tabs, width 120, single quotes, no trailing commas.
- No hex colours in components.
- No hard-coded user strings: add TR/EN/NL keys to `strings.ts`.
- `babs.ts` is mirrored server↔web — change both together.
- Serializer types mirror `apps/web/src/lib/types/domain.ts` field-for-field.
- The server suite needs `pnpm db:up`.
- Update `CLAUDE.md` where a documented rule changes.

**Commands:**
- Server tests: `pnpm --filter @cuzhane/server test`. Single file: `cd apps/server && pnpm exec vitest run test/services/<file>.test.ts`.
- Web tests: `pnpm --filter @cuzhane/web test`.
- Types: `pnpm check-types`.
- Lint: `pnpm lint`.
- Prisma: `pnpm --filter @cuzhane/server db:migrate --name <name>`, then `db:generate`.

---

## Phase 0 — Remove the reading-groups feature

### Task 0.1: Server removal + drop migration

**Files:**
- Delete:
  - `apps/server/prisma/schema/reading.prisma`
  - `apps/server/src/services/readingGroups.service.ts`
  - `apps/server/src/routes/reading.route.ts`
  - `apps/server/src/schemas/reading.schema.ts`
  - `apps/server/src/utils/readingRotation.ts`
  - `apps/server/src/content/readingPlans.ts`
  - `apps/server/test/services/readingGroups.service.test.ts`
  - `apps/server/test/services/readingRotation.util.test.ts`
  - `apps/server/test/services/readingRoutes.test.ts`
  - `apps/server/test/services/readingSchema.test.ts`
- Modify:
  - `apps/server/src/app.ts` — drop the import and the `/api/reading-groups` mount.
  - `apps/server/src/services/account.service.ts` — drop the reading cleanup lines.
- Create: `apps/server/prisma/migrations/<ts>_drop_reading_rotation/migration.sql`

**Steps:**
1. Delete the files. Remove the references in `app.ts` and `account.service.ts`, and leave the old migration folder in place.
2. Run `pnpm --filter @cuzhane/server db:migrate --name drop_reading_rotation`. Prisma generates the `DROP TABLE` statements for `ReadingAssignment`, `ReadingCycle`, `ReadingMembership` and `ReadingGroup`, plus `DROP TYPE "ReadingCadence"`. Check that it also drops the partial index `ReadingMembership_one_active_user`; that goes with the table.
3. `pnpm --filter @cuzhane/server check-types && pnpm --filter @cuzhane/server test`. Expected: green, with fewer tests.
4. Commit `chore(hizb): remove the unreleased reading-groups model`.

### Task 0.2: Web removal (keep the free reader)

**Files:**
- Delete:
  - `apps/web/src/api/readingGroups.api.ts`
  - `apps/web/src/lib/hooks/useReadingGroups.ts`
  - `apps/web/src/lib/content/hizbProgress.ts` and `hizbProgress.test.ts`
  - `apps/web/src/screens/Hizb/HizbGroupsScreen.component.tsx`
  - `HizbGroupScreen.component.tsx`
  - `HizbProgressGrid.component.tsx` and `HizbProgressGrid.types.ts`
- Modify:
  - `navigation/AppNavigator.tsx` and `navigation/types.ts` — remove the `HizbGroups` and `HizbGroup` routes.
  - `screens/Groups/GroupsScreen.component.tsx:117` — remove the Hizb groups button.
  - `strings.ts` — remove the `hr*` keys nothing references any more, in all three languages.
  - `HizbReaderScreen` — remove its assigned mode for now (Task 5.1 rebuilds it); the free mode stays.
  - `hizbAssignments.ts` — delete if it has no other users.
- **Keep:**
  - `HizbSectionsScreen`, `HizbReaderScreen` (free mode) and `HizbBody`
  - `hizbulhakaik*.ts`
  - the Profile row that opens free reading

**Steps:**
1. Remove the code. `pnpm --filter @cuzhane/web check-types && pnpm --filter @cuzhane/web lint && pnpm --filter @cuzhane/web test`.
2. Commit `chore(hizb): remove reading-group screens, keep free reading`.

---

## Phase 1 — Server: part count and MONTHLY

### Task 1.1: `GroupKind` column

**Files:**
- Modify: `apps/server/prisma/schema/group.prisma`
- Create: `apps/server/src/utils/groupKinds.ts`
- Test: `apps/server/test/services/groupKinds.util.test.ts`

**Schema:**

```prisma
enum GroupKind {
    CEVSEN
    HIZB
}

enum GroupCycle {
    DAILY
    WEEKLY
    MONTHLY
}
// in model Group:
    kind              GroupKind       @default(CEVSEN)
```

**`groupKinds.ts`:**

```ts
/** What a group reads. Immutable after creation; a new division would be a new kind, never a re-read of this one. */
export type GroupKindName = 'CEVSEN' | 'HIZB';

/** How many parts a group of each kind divides among its seats. The Hizb's 33 is the revised book division. */
export const PART_COUNT: Record<GroupKindName, number> = { CEVSEN: 100, HIZB: 33 };

/** Parts a single reader must repeat before they count as read — Sekine, 19 times from its Besmele. */
const REQUIRED_REPETITIONS: Record<GroupKindName, Readonly<Record<number, number>>> = {
	CEVSEN: {},
	HIZB: { 19: 19 }
};

export const partCountFor = (kind: GroupKindName) => PART_COUNT[kind];

export const requiredRepetitions = (kind: GroupKindName, partNumber: number): number =>
	REQUIRED_REPETITIONS[kind][partNumber] ?? 1;

/** Which cycles a kind may be created with. The Cevşen keeps its two; the Hizb adds a month. */
export const CYCLES_FOR_KIND: Record<GroupKindName, readonly ('DAILY' | 'WEEKLY' | 'MONTHLY')[]> = {
	CEVSEN: ['DAILY', 'WEEKLY'],
	HIZB: ['DAILY', 'WEEKLY', 'MONTHLY']
};
```

**Tests:** `partCountFor('CEVSEN') === 100`, `partCountFor('HIZB') === 33`, `requiredRepetitions('HIZB', 19) === 19`, `requiredRepetitions('HIZB', 18) === 1`, `requiredRepetitions('CEVSEN', 19) === 1`.

**Steps:**
1. Write the test and run it: FAIL, module missing.
2. Add the util and the schema.
3. Run `db:migrate --name add_group_kind_and_monthly_cycle`, then `db:generate`. The migration adds the `GroupKind` enum, the column with its default (existing rows become CEVSEN) and `ALTER TYPE "GroupCycle" ADD VALUE 'MONTHLY'`.
4. Tests pass. Commit.

### Task 1.2: `utils/babs.ts` takes the part count (server and web mirror)

**Files:**
- Modify: `apps/server/src/utils/babs.ts`, `apps/web/src/lib/utils/babs.ts` (identically)
- Test: `apps/server/test/services/babs.util.test.ts`, plus the web counterpart if one exists

**Change:**
- Keep `BAB_COUNT = 100`, but only as the Cevşen's number. Nothing in the seat math may read it.
- Add a required `partCount` parameter to each of these (callers pass `partCountFor(group.kind)`):
  - `rangeForSlot(slotIndex, spots, partCount)`
  - `babNumbersForSlot(slotIndex, spots, partCount)`
  - `rangeForRound(slotIndex, spots, roundIndex, partCount)`
  - `babNumbersForRound(slotIndex, spots, roundIndex, partCount)`
  - `slotIndexForBab(babNumber, spots, partCount)`
  - `babsPerPerson(spots, partCount)`
- `progressPercent(read, total)`: `total` becomes required.

The new `rangeForSlot`:

```ts
export const rangeForSlot = (slotIndex: number, spots: number, partCount: number): BabRange | null => {
	if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= spots || spots <= 0 || partCount <= 0) {
		return null;
	}

	const base = Math.floor(partCount / spots);
	const remainder = partCount % spots;
	const extrasBefore = Math.min(slotIndex, remainder);
	const start = slotIndex * base + extrasBefore + 1;
	const size = base + (slotIndex < remainder ? 1 : 0);

	return size <= 0 ? null : { start, end: start + size - 1 };
};
```

**New tests** (keep every existing one, passing `BAB_COUNT`):
- 33 over 11 seats tiles 1..33 exactly, three each.
- 33 over 16 seats: seat 0 gets 1–3, seat 1 gets 4–5, …, and seat 15 ends at 33.
- 33 over 33 seats is one each.
- 33 over 1 seat is 1–33.
- For every spots value in 1..33 and rounds 0..40, the union of `babNumbersForRound` over all seats is exactly 1..33, with no duplicates.
- `slotIndexForBab(34, 11, 33) === null`.

**Steps:**
1. Update the tests. They FAIL because they pass the new argument into the old signature.
2. Implement on both sides.
3. Fix the compile errors at every caller. The ones not yet converted pass `BAB_COUNT` for now; Task 1.4 converts them properly.
4. Server tests pass. Commit.

### Task 1.3: MONTHLY rounds in `utils/rounds.ts`

**Files:**
- Modify: `apps/server/src/utils/rounds.ts`
- Test: `apps/server/test/services/rounds.util.test.ts`

**API change** (cycle-based, so MONTHLY fits):

```ts
export type CycleName = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Fixed-length cycles, in days. MONTHLY is not a number of days, so it is absent by construction. */
export const ROUND_DAYS: Record<'DAILY' | 'WEEKLY', number> = { DAILY: 1, WEEKLY: 7 };

const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/**
 * The local day on which round `roundIndex` begins, as a civil day number. Round 0's day is the start's own.
 * A month is the anchor's day-of-month in each later month, clamped: a group started on the 31st rolls on
 * Feb 28, then Mar 31 — measured from the anchor every time, never from the previous boundary.
 */
export const boundaryDayNumber = (startedAt: Date, cycle: CycleName, roundIndex: number, timeZone: string): number => {
	const startDay = civilDayNumber(startedAt, timeZone);

	if (cycle !== 'MONTHLY') {
		return startDay + Math.max(0, roundIndex) * ROUND_DAYS[cycle];
	}

	const { year, month, day } = wallClockIn(startedAt, timeZone);
	const target = month - 1 + Math.max(0, roundIndex);
	const targetYear = year + Math.floor(target / 12);
	const targetMonth = ((target % 12) + 12) % 12;
	const clamped = Math.min(day, daysInMonth(targetYear, targetMonth));

	return Math.floor(Date.UTC(targetYear, targetMonth, clamped) / DAY_MS);
};

export const roundIndexSince = (startedAt: Date, cycle: CycleName, now: Date, timeZone: string): number => {
	const today = civilDayNumber(now, timeZone);
	const startDay = civilDayNumber(startedAt, timeZone);

	if (today <= startDay) {
		return 0;
	}

	if (cycle !== 'MONTHLY') {
		return Math.floor((today - startDay) / ROUND_DAYS[cycle]);
	}

	const start = wallClockIn(startedAt, timeZone);
	const current = wallClockIn(now, timeZone);
	let index = (current.year - start.year) * 12 + (current.month - start.month);

	// The month difference overshoots by one before this month's boundary day has arrived.
	while (index > 0 && boundaryDayNumber(startedAt, cycle, index, timeZone) > today) {
		index--;
	}

	return index;
};

export const roundStartedAtFor = (startedAt: Date, cycle: CycleName, roundIndex: number, timeZone: string): Date =>
	roundIndex <= 0 ? startedAt : startOfCivilDay(boundaryDayNumber(startedAt, cycle, roundIndex, timeZone), timeZone);

/** When round `roundIndex` runs out: the start of the next one. Takes the anchor, because a clamped month cannot be derived from the previous boundary. */
export const roundEndsAt = (startedAt: Date, cycle: CycleName, roundIndex: number, timeZone: string): Date =>
	startOfCivilDay(boundaryDayNumber(startedAt, cycle, roundIndex + 1, timeZone), timeZone);
```

**Callers to update** — each passes the anchor and round index instead of the round's start:
- `services/rounds.service.ts:17, 59, 69`
- `services/roundHistory.service.ts:76–78, 372–374`
- `services/groups.service.ts:146, 279, 323`
  - At :146 a GATHERING group's placeholder `endsAt` becomes `roundEndsAt(startsAt, input.cycle, 0, tz)`.
  - At :279 and :323 it becomes `roundEndsAt(startedAt, group.cycle, 0, tz)`.
- `services/groupSerializers.ts:381, 557` — `roundEndsAt(group.startedAt, group.cycle, group.roundIndex, group.timezone)`, guarded on `startedAt`.
- `prisma/seed.ts:700–703`

**Tests:**
- Convert the numeric `DAILY`/`WEEKLY` constants in `rounds.util.test.ts` to the cycle names; every existing expectation must still hold.
- Add these:
  - **Clamping.** MONTHLY started 2027-01-31 10:00 UTC (in UTC): round 1 begins 2027-02-28T00:00Z, round 2 on 2027-03-31T00:00Z and round 3 on 2027-04-30.
  - **Boundary.** `roundIndexSince` is 0 at 2027-02-27T23:59Z and 1 at 2027-02-28T00:01Z.
  - **Two ends in a row.** `roundEndsAt(start, 'MONTHLY', 0)` is Feb 28 and `roundEndsAt(start, 'MONTHLY', 1)` is Mar 31. From Feb 28 alone that would have been Mar 28.
  - **Istanbul zone.** A group started 2026-09-26T15:00Z rolls at 2026-10-25T21:00Z, which is local midnight on Oct 26.
  - **Year wrap.** Started 2026-12-15, round 1 is on 2027-01-15.
  - **Consistency.** For 400 random `now` values over 3 years, `roundStartedAtFor(start, 'MONTHLY', roundIndexSince(start, 'MONTHLY', now)) <= now`.
- In the other test files, replace `ROUND_DAYS[cycle]` with `cycle`:
  - `rounds.service.test.ts`, `roundHistory.service.test.ts`, `readAllShare.service.test.ts` and `joinPoolClaim.service.test.ts`.
  - At `roundHistory.service.test.ts:46`, compute the round index with `roundIndexSince` instead of `floor(days / ROUND_DAYS)`.

**Steps:**
1. Write the new tests: FAIL.
2. Implement. Fix the callers and the tests.
3. `pnpm --filter @cuzhane/server test`: PASS.
4. Commit `feat(rounds): add MONTHLY cycle anchored on the start's day of month`.

### Task 1.4: Thread the part count through serializers and services

**Files:**
- `services/groupSerializers.ts`
  - `PlanShape` becomes `Pick<Group, 'spots' | 'splitMode' | 'kind'>`.
  - `babNumbersInRound`, `rangeInRound`, `poolBlocks` and `poolBabNumbers` compute `partCountFor(group.kind)`.
  - Add `kind` and `partCount` to `GroupSummary`, `GroupDetail` and `GroupInvitePreview`.
- `services/babs.service.ts:17` — `validateBabNumber` moves after the group is loaded and checks `1..partCountFor(group.kind)`. The route schema's `max(100)` stays as an outer bound.
- `services/groups.service.ts`
  - `createGroupForUser` creates `partCountFor(input.kind)` rows at :183.
  - It stores `kind`.
- `services/roundHistory.service.ts`
  - `owedSlotForBab` passes the part count.
  - :144, :154, :187, :212 and :245 use `partCountFor(group.kind)`.
  - `RoundSummary` gains `partCount`.
- `services/pool.service.ts`
  - The `poolBlockFor` param type gains `kind`.
- `services/profile.service.ts:76`
  - `roundsCompleted` compares each round's count against its group's part count. Group by `groupId` and join `kind`.
  - Keep "total babs read" counting CEVSEN reads only (`group: { kind: 'CEVSEN' }`) so the bab-labelled stats stay honest.
  - The streak and heatmap count any read — reading activity is reading activity.
- `schemas/group.schema.ts`
  - Add `kind: z.enum(['CEVSEN','HIZB']).default('CEVSEN')` and let `cycle` include MONTHLY.
  - Spots and cycle are validated per kind with `superRefine`:
    - CEVSEN: spots in `[5,10,20]`, and cycle must not be MONTHLY.
    - HIZB: spots is an integer from 1 to 33.
  - `CoverRoundBabsBodySchema` and `BabParamsSchema` keep `max(100)` as the outer bound; the service checks the real count.
  - `DiscoverQuerySchema.cycle` accepts MONTHLY.

**Tests** (integration, real test DB):
- `groups.service` creating `{kind:'HIZB', spots: 11, cycle:'MONTHLY'}` writes 33 `GroupBab` rows and serializes `partCount: 33`.
- Creating `{kind:'CEVSEN', cycle:'MONTHLY'}` is rejected with 400.
- Creating HIZB with spots 34 is rejected with 400.
- `setBabRead` on a HIZB group with bab 34 returns 400.
- The round detail of a HIZB group lists 33 babs.
- A fully read HIZB round counts toward `roundsCompleted`.
- Every existing test still passes. Existing fixtures default to CEVSEN.

**Steps:**
1. Write the tests: FAIL.
2. Implement.
3. `pnpm --filter @cuzhane/server test && check-types`: PASS.
4. Commit `feat(groups): a group reads CEVSEN (100) or HIZB (33) parts`.

### Task 1.5: Push copy and inbox nouns

**Files:** `apps/server/src/utils/pushCopy.ts` and its callers (`babs.service.ts`, `pool.service.ts`, `groupMembership.service.ts`, `groupEvents.service.ts`), plus `services/notifications.service.ts`.

**Change:**
- The copy functions that name babs or "100" take `{ kind }`:
  - HIZB reads "bölüm" / "portion" / "gedeelte" (TR/EN/NL).
  - The round-complete line says "33 bölümün hepsi" / "all 33 portions".
- The inbox serializer includes the group's `kind`, joined from `groupId`, so the client picks its noun. Add `kind` to the notification wire type on both sides.

**Tests:** pushCopy unit tests for both kinds and all three languages.

Commit `feat(push): name portions in Hizb group notifications`.

---

## Phase 2 — Server: Hizb-specific behaviour

### Task 2.1: Per-portion pool claim

**Files:**
- Modify:
  - `services/pool.service.ts`
  - `routes/groups.route.ts`
  - `schemas/group.schema.ts`
  - `services/groupMembership.service.ts:162–245` (the join path)
- Test: `apps/server/test/services/poolPart.service.test.ts`

**API:**
- `POST /api/groups/:groupId/pool/parts/:babNumber` takes one portion.
- `DELETE` on the same path releases it.
- Params schema: `PoolPartParamsSchema = { groupId, babNumber: coerce int 1..100 }`.
- Both are allowed only when `group.kind === 'HIZB'`; a CEVSEN group returns 400. A Cevşen slot is still taken whole — that CLAUDE.md rule stands for the Cevşen.

**Service** (same shape as `takePoolSlotForUser`):
1. `lockGroup`, then `ensureCurrentRound`, then require RUNNING.
2. The part must be in `poolBabNumbers(group, members, roundIndex)`; otherwise 400.
3. Claim with `updateMany({ where: { groupId, number, assignedUserId: null }, data: { assignedUserId: me } })`. A count of 0 returns 409.
4. Notify with the existing `POOL_BAB_CLAIMED` event. Its range is the single number.
5. Release mirrors `releasePoolSlotForUser`, restricted to that one number:
   - clear the caller's read on it and delete its `BabRead`;
   - clear the claim;
   - run `syncCompletedAt` in the same transaction.

**`PoolSlot` gains `parts`:**

```ts
parts: { number: number; takenByUserId: string | null; takenByDisplayName: string | null; takenByImageUrl: string | null; takenByMe: boolean; isRead: boolean }[];
```

`takenByUserId` on the slot stays the first claimant, for the Cevşen UI.

**Join path:** a block may now hold several claimants.
- Replace the single `findFirst` with a `findMany` of the claimed babs in `coveredBabNumbers`, grouped by `assignedUserId`.
- For each claimant, write one `PoolClaimRelease` per contiguous run (`babRuns`), recording that claimant's own numbers — not the whole block.
- Send each claimant their own push and inbox row.
- `released` becomes an array.

**Tests:**
- Two members take different portions of one pool block. Both succeed, and `parts` shows each taker.
- Two simultaneous takes of the same portion: exactly one 409.
- Taking a portion that is not in the pool returns 400.
- Calling the endpoint on a CEVSEN group returns 400.
- A join into the seat releases both claimants, with two `PoolClaimRelease` rows carrying their own ranges.
- Release clears only the releaser's read.
- The existing `joinPoolClaim` Cevşen tests still pass.

Commit `feat(pool): claim a single Hizb portion from the pool`.

### Task 2.2: Sekine repetitions

**Files:**
- Modify:
  - `prisma/schema/bab.prisma`
  - `services/babs.service.ts`
  - `services/roundHistory.service.ts`
  - `routes/babs.route.ts`
  - `schemas/bab.schema.ts`
  - `services/account.service.ts`
- Create: `services/repetitions.service.ts`
- Test: `test/services/repetitions.service.test.ts`

**Schema** (add `repetitions GroupPartRepetition[]` to `Group`):

```prisma
/** How many times one reader has repeated a part that must be read more than once (Sekine ×19), per round. */
model GroupPartRepetition {
    id         String   @id @default(cuid())
    groupId    String
    userId     String
    roundIndex Int
    partNumber Int
    count      Int      @default(0)
    updatedAt  DateTime @updatedAt

    group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

    @@unique([groupId, userId, roundIndex, partNumber])
    @@index([userId])
}
```

**API:**
- `GET /api/groups/:groupId/babs/:babNumber/repetitions?roundIndex=n` returns `{ count, required }`. `roundIndex` defaults to the current round.
- `PUT` on the same path with body `{ count: int 0..required, roundIndex?: int ≥ 0 }` returns `{ count, required }`.

An **absolute** set is idempotent under retries. The alternative, an increment, double-counts a retried request.

**Rules:**
- The caller must be a member.
- The part must require more than 1 repetition; otherwise 400.
- `count` is clamped by validation to `0..required`.
- `roundIndex` must be `<=` the group's current round (after `ensureCurrentRound`). A future round returns 400.
- Only the caller's own row is ever written.

**`assertRepetitionsMet(tx, { group, userId, roundIndex, babNumbers })`** throws 409 `'Sekine must be read 19 times first'` when any number needs `requiredRepetitions > 1` and the caller's stored count for that round is below it. Call it:
- in `setBabReadForUser` when `read === true`, after the share/pool check;
- in `setAssignedBabsReadForUser`, over the numbers it is about to mark;
- in `coverMissedBabsForUser` / `coverMissedBabForUser`, against **that past round's** index.

Undoing a read never checks it.

**Account deletion:** `groupPartRepetition.deleteMany({ where: { userId } })`.

**Tests:**
- PUT 19 then mark 19: OK.
- PUT 18 then mark: 409.
- PUT 20: 400.
- PUT on part 18: 400.
- Another member's count does not satisfy mine.
- A new round starts at 0.
- Covering Sekine in a past round requires that round's own count of 19.
- A retried PUT of 5 leaves 5.
- Unmarking keeps the count.

Commit `feat(hizb): Sekine counts only after 19 personal repetitions`.

---

## Phase 3 — Web foundations

### Task 3.1: Domain types, kind helpers, cycles

**Files:**
- `lib/types/domain.ts`
  - `GroupKind = 'CEVSEN' | 'HIZB'`
  - `GroupCycle` adds `'MONTHLY'`
  - `kind` and `partCount` on `GroupSummary`, `GroupInvitePreview`, `RoundSummary` and the notification type
  - `PoolSlot.parts`
- `lib/utils/groupKinds.ts` — mirrors the server file, plus `CYCLES_FOR_KIND` and `SPOTS_FOR_KIND`:
  - CEVSEN: `[5,10,20]`
  - HIZB: 1..33
- `lib/utils/groups.ts`
  - `CYCLE_OPTIONS` becomes `CYCLES_FOR_KIND[kind]`.
  - `cycleLabelKey` becomes a `Record<GroupCycle, StringKey>` with `monthly`.
  - `emptyBabCells(total)`.
- Every MONTHLY-blind switch:
  - `PeriodStrip:18` — add `MONTHLY: 6` (six periods).
  - `utils/roundReset.ts:133` — monthly reset copy: "Her ayın {day}. günü 00:00", day taken from `startedAt` in the group zone.
  - `MyProgressScreen:71`
  - `GroupDetailScreen:264`
  - `utils/groupBrowse.ts:7`
  - `DiscoverScreen:37–41` — add Aylık to the filter.
- `lib/schemas/group.schema.ts`
  - `createGroupSchema(t)` adds `kind`, validates spots/cycle per kind with `superRefine`, and cycle includes MONTHLY.
- `api/groups.api.ts`
  - `CreateGroupInput.kind`
  - `takePoolPart` / `releasePoolPart`
  - `getRepetitions` / `setRepetitions`
- `lib/hooks/usePool.ts` (or wherever pool hooks live)
  - `useTakePoolPart` / `useReleasePoolPart`, optimistic like the slot hooks.
- `lib/hooks/useRepetitions.ts`
  - Query plus mutation. The mutation is optimistic with the cancel/snapshot/rollback pattern of `useSetBabRead`.
- Tour fixtures (`tourDemoData`) — `kind: 'CEVSEN', partCount: 100`.

**Tests:**
- `groupKinds` mirrors the server table.
- `cycleLabelKey('MONTHLY') === 'monthly'`.
- The create schema accepts `{kind:'HIZB', spots: 7, cycle:'MONTHLY'}`, rejects `{kind:'CEVSEN', cycle:'MONTHLY'}` and rejects `{kind:'CEVSEN', spots: 7}`.

`pnpm check-types` must pass. That forces every `BAB_COUNT` call site from the explore report to take `group.partCount`, including:
- `GroupProgressSummary`
- `PlanPreview`
- `ReaderBabMap`
- `GroupDetailScreen:372/722/728`
- `InvitePreviewScreen:116/268`
- `JoinByCodeSheet:295`
- `RoundsScreen:27`
- `RoundDetailSkeleton:51`

Also fix the existing bug where the lobby card in the groups list passes `readCount={memberCount}` (`GroupsScreen:156`): show members out of spots there, not babs.

Commit.

### Task 3.2: The 33-portion manifest and portion slicing

**Files:**
- Create: `apps/web/src/lib/content/hizbPortions.ts`
- Test: `apps/web/src/lib/content/hizbPortions.test.ts`

**Shape:**

```ts
/** A position in hizbulhakaik.data.json. `invocation` splits a line at its ❁ marks; absent means the line's start. */
export type HizbAnchor = { section: number; block?: number; line?: number; invocation?: number };

export type HizbWork = { key: HizbWorkKey; titleKey: StringKey; parts: [number, number] };

export type HizbPortion = {
	number: number; // 1..33
	work: HizbWorkKey;
	descriptionKey: StringKey;
	start: HizbAnchor; // inclusive; the portion runs to the next portion's start (the last to the end of the text)
	repetitions?: number; // Sekine: 19
};
```

**The 10 works:**

| Work | Portions |
|---|---|
| quran | 1–3 |
| cevsen | 4–8 |
| evrad | 9–13 |
| delail | 14–18 |
| sekine | 19 |
| munacatIsmiAzam | 20 |
| munacatQuran | 21–25 |
| tahmidiye | 26 |
| hulasa | 27–30 |
| tazarru | 31–33 |

**Start anchors** (verified against the data on 2026-09-26; the review doc has the photo times):

```
1 {0}          2 {2}          3 {4}          4 {7,0}        5 {7,18}       6 {7,39}       7 {7,59}
8 {7,79}       9 {8}          10 {8,0,8,2}   11 {8,0,12,9}  12 {8,0,17}    13 {8,0,21,2}  14 {9}
15 {9,4}       16 {9,7}       17 {9,10}      18 {9,18}      19 {10}        20 {11}        21 {14,0}
22 {14,12}     23 {14,26}     24 {14,42}     25 {14,60}     26 {15}        27 {16,0}      28 {16,6}
29 {16,16}     30 {16,27}     31 {16,28,3}   32 {16,28,9}   33 {16,28,15}
```

**`portionBlocks(number): HizbBlock[]`** returns the blocks between this start and the next start. Lines are sliced at the anchor's line and invocation.

**Mid-line slicing** cuts the line's own `text` at the Nth `❁` occurrence. It does **not** join `invocations` back together: 13 lines are not byte-equal to `invocations.join(' ❁ ')` because the source's spacing around ❁ varies. The same cut also slices `invocations`, so both fields stay consistent. Trim the leading space after the cut and the trailing space before it — only whitespace, never a character of the text.

Also export `HIZB_WORKS`, `portion(number)`, `workOf(number)` and `worksForParts(numbers)`. The last returns the distinct work title keys in order, and JoinedWelcome's "15–16 · Delâilü'n-Nûr" uses it.

**Tests** (quoting existing text only — nothing generated):
- Exactly 33 portions, numbered 1..33, and the works cover 1..33 contiguously.
- The anchors are strictly increasing in document order.
- The concatenation of all `portionBlocks` text, with the cut points rejoined, is byte-identical to the whole document's lines. That means no omission and no overlap.
- Each portion starts with its expected prefix, one assertion per portion, taken from the data. For example:
  - 10 → `'اَللّٰهُ لَٓا اِلٰهَ اِلَّا'`
  - 11 → `'مَرْحَبًا مَرْحَبًا بِالصَّبَاحِ'`
  - 12 → `'طٰسٓمٓ'`
  - 13 → `'اَلصَّابِرٖينَ'`
  - 22 → `'(اِبْرَاهٖيم:)'`
- The Cevşen portions contain closings ﴿١﴾–﴿٢٠﴾, ﴿٢١﴾–﴿٤١﴾, ﴿٤٢﴾–﴿٦١﴾, ﴿٦٢﴾–﴿٨١﴾ and ﴿٨٢﴾–﴿١٠٠﴾ respectively. Each ﴿N﴾ appears in exactly one portion.
- For each mid-line anchor, the ❁ count in `text` equals `invocations.length - 1`.
- Portion 19 has `repetitions: 19` and matches the server's `requiredRepetitions`: a literal `{19: 19}` asserted on both sides.

**Strings:**
- `hizbWork*` — 10 keys × TR/EN/NL.
- `hizbPart{n}Desc` — 33 keys × TR/EN/NL. The TR copy follows the photo anchors, for example:
  - 15: "“Şeceratü'l-asli'n-nûrâniyye”den – “men minhü'nşakkati'l-esrâr”a kadar"
  - 19: "Besmeleden itibaren 19 defa"
  - 21: "Fâtiha'dan – İbrâhîm'e kadar"
  - 31: "Geylânî Hz. duâsı: “İlâhî ez-zünûbü…”"

  EN and NL keep the same transliterations with translated connectors ("from … to …", "van … tot …").

Commit `feat(hizb): the 33-portion manifest over the existing text`.

---

## Phase 4 — Web screens (follow the frames; tokens and components only)

Every screen below branches on `group.kind`. The Cevşen paths must render byte-for-byte as before; check them visually.

- **HIZB nouns:** "bölüm" / "portion" / "gedeelte".
- **Brand glyph** for the Hizb: the eight-pointed star with a ring, from HC1. Convert it into the icon set as `hizb` and add it to `CuzhaneSymbols` via `build-symbols.mjs`. On a dev client built before the new native build it falls back to the drawn `Icon`.

### Task 4.1: Create flow (HC1–HC3)

**Files:** `screens/Groups/CreateGroupScreen.component.tsx`, `CreateGroupStepHeader.component.tsx`, `strings.ts`

**Step structure:**
- `CreateGroupStep = 1|2|3|4`. `FIELDS_BY_STEP`:
  - `{1:['kind'], 2:['name','dedication','visibility'], 3:['spots','splitMode'], 4:['cycle']}`
- `LAST_STEP = 4`, with eyebrows `step1of4…step4of4` and `StepProgress total={4}`.
- `SHEET_HEIGHT_RATIO` stays one constant.

**Step 1 (HC1):**
- A row of two option cards bound to `kind`, each with glyph, name, hint and mono count ("100 bab" / "33 bölüm").
- The info card reads:
  > Hizbü'l-Hakaik: Kur'an bölümünden Tazarru ve Niyaz'a 33 bölüm. Cevşen gibi dönüşümlü ya da sabit okunur; boşta kalan bölümleri tek tek üstlenebilirsin.
- Changing `kind` resets `spots`, `cycle` and `splitMode` to that kind's defaults with `setValue`:
  - CEVSEN: 20, DAILY, ROTATION
  - HIZB: 33, DAILY, ROTATION — one portion a day each, the family's practice

**Step 2 (HC2):** today's step 1, unchanged.

**Step 3 (HC3):**
- **CEVSEN** is unchanged.
- **HIZB:**
  - `FormStepper` with values `1..33` and the caption "{spots} kişi · kişi başı {n} bölüm".
  - `SpotsGrid` with `maxTotal={33}` and `columns={11}`.
  - The note "33 bölüm bu kadar kişiye paylaştırılır".
  - The same `splitMode` options.
  - `PlanPreview` with `total={33}`. HC3's "DÖNÜŞÜM · 33 bölüm · N turda" rows come from `rangeForRound`.

**Step 4:** cycle `Select` from `CYCLES_FOR_KIND[kind]`, so the Hizb gets Günlük / Haftalık / Aylık.

**Submit:** sends `kind`.

**Verify:** both kinds create on the simulator. The form values survive step changes: type a name, go to step 4, go back to 2, and the name is still there.

Commit.

### Task 4.2: Lobby (HC4), preview (HJ1/HJ2), joined-waiting (HJ3)

**Files:**
- `screens/Groups/LobbyScreen.component.tsx`
- `screens/Join/InvitePreviewScreen.component.tsx`
- `screens/Join/JoinByCodeSheet.component.tsx`
- `screens/Join/JoinedWelcomeScreen.component.tsx`

**HC4 (lobby):**
- The heading has the "KURUCU" eyebrow and a sand "TOPLANIYOR" chip, with the Hizb glyph at the right.
- The "Sayım henüz başlamadı" description.
- Seat card: "N / spots katıldı · M boş kontenjan", a progress bar and `SpotsGrid` (11 columns), with the caption "Bölümler başlatınca sırayla dağıtılır ve her tur bir ileri kayar."
- Details card: Süre and Okuma planı.
- The invite card, QR, avatars, auto-start toggle and "Şimdi başlat" are unchanged.

**HJ1 (preview, not started):**
- Chips "BAŞLAMADI" and the cycle.
- The subtitle "{plan} · kişi başı {n} bölüm".
- The "BAŞLANGIÇ" card with two rows (manual start, auto when full), the join progress and "{n} yer kaldı".
- Details: Ritim ("Haftalık · Pazartesi" — the weekday of `startsAt`; monthly reads "Aylık · ayın {day}. günü"), Okuma planı, Kontenjan and Kuran.
- "BEKLEYEN ÜYELER" avatars, then "Katıl · başlangıcı bekle".

**HJ2 (preview, full):**
- Chip "DOLU · 33/33".
- The "Bu grup dolu" card.
- The "ŞU ANKİ TUR n / 33" bar with "33 bölümün hepsinin sahibi var".
- Details, then "Benzer açık gruplara bak", which opens Keşfet.

**HJ3 (joined, waiting):**
- The clock disc, "Katıldın — başlangıcı bekliyor" and "Bölümlerin hazır. Grup başlayınca açılır."
- A hatched card: "BÖLÜMLERİN 15–16", `worksForParts` beneath it, and the "Başlangıçta açılır" lock chip.
- The join progress, "Gruplarıma dön", and a danger "Gruptan ayrıl" that uses the existing leave mutation.

Commit.

### Task 4.3: Group screen (HZ1)

**Files:**
- `screens/Groups/GroupDetailScreen.component.tsx`
- Create:
  - `components/HizbBoard/HizbBoard.component.tsx` + `.types.ts`
  - `components/HizbPartRow` (or reuse `BabRow` with a description line)

**Sections, top to bottom:**
1. **Heading:** title, cycle chip, the Hizb glyph and "Tur {n} · {plan}".
2. **Stats card:** "{read} / 33 BÖLÜM OKUNDU" | "{d} gün TUR BİTİMİNE", with the boundary row from `roundReset` (group zone | viewer's local time).
3. **`MyProgressCard`**, unchanged.
4. **"BU TUR BÖLÜMÜN" panel:** the range chip and the first work name, "0/2", and a collapse chevron. It lists one row per portion in the share: checkbox, "{n}. bölüm · {work}", the description and an "Oku" button that opens the portion reader.
   - For a portion needing repetitions whose count is below the requirement, the checkbox opens the reader instead of marking. The row's subline reads "{count} / 19 tekrar".
   - Pool portions I claimed are listed in the same panel, as the Cevşen screen lists pool babs.
5. **"Geçen tur" card:** the existing one, in bölüm.
6. **"Ortak havuz" card:** the existing one, counting free portions: "{n} sahipsiz bölüm · üstlenebilirsin".
7. **"Grubun ilerlemesi" card with `HizbBoard`:**
   - One row per work: its name on the left and its cells right-aligned, 40pt squares on a `CellGrid`-like flat style.
   - Cell states and their tokens:
     - okundu — solid accent
     - alındı (a seat this round, or pool-claimed) — `accentSoft`
     - sahipsiz — hatched `sand`
     - senin — a `text`-coloured ring
   - The legend underneath, and a "Fihrist ›" link.
   - It keeps the CLAUDE.md board-performance rules: `memo` cells, `useMemo` items, a flat transition style and no per-cell `useAnimatedStyle`.

Commit.

### Task 4.4: Fihrist (HZ2)

**Files:**
- Create: `screens/Groups/HizbIndexScreen.component.tsx`
- Register `HizbIndex: { groupId }` in `sharedTabScreens` and `TabDetailParamList`.

**Layout:**
- Eyebrow "HİZBÜ'L-HAKAİK", title "Fihrist" and the caption "33 bölüm · 10 eser · Tur {n}".
- One card per work: the title in the heading font, "{a}–{b}. bölüm", a mono count "{read}/{total}" (accent when complete) and a chevron.
- Tapping a card expands it in place. At most one is expanded at a time.
- Each row inside shows the number tile (ring = mine), the description, and "{reader} · Okunuyor|Okundu|Sahipsiz". A tap opens the reader on that portion.

Commit.

### Task 4.5: Pool (HZ3)

**Files:** `screens/Groups/PoolScreen.component.tsx` (HIZB branch)

**Layout:**
- Eyebrow "ORTAK HAVUZ", title "Sahipsiz bölümler" and the caption.
- A card: the big sand number with "sahipsiz bölüm" and "{d} gün kaldı", then a 33-cell grid (11 columns) in the HizbBoard states, with the legend.
- Below the card, a list of **unclaimed** portions and of those **I claimed this session**:
  - The hatched number tile, "{n}. bölüm · {work}" and the description.
  - An accent "Üstlen", or "Geri al" for my own this-session claims — the same `takenHere` rule as the Cevşen screen.

Behaviour:
- Claims and releases are optimistic.
- The cell fill follows `pool-fill` (colour only, 420ms).

Commit.

### Task 4.6: Rounds (HZ4) and round detail (HZ5)

**Files:**
- `screens/Groups/RoundsScreen.component.tsx`
- `RoundDetailScreen.component.tsx`
- `RoundDetailSkeleton`

**Rounds (HZ4):**
- `BAB_TOTAL` becomes `round.partCount`.
- The cycle chip and the caption "Her tur 33 bölümün tamamı hedeflenir. Tur kapanınca eksik kalan bölümler kayda geçer."
- Cards:
  - the open round, outlined, with "Senin: x/y";
  - closed rounds with "{n} EKSİK" in `danger`, and "16, 24 ve 31 okunmadı" when there are three or fewer, otherwise "{n} bölüm okunmadı";
  - a "TAMAM" chip on complete rounds.
- Date ranges come from `boundsFor`, which already handles MONTHLY once Task 1.3 lands.

**Round detail (HZ5):**
- Eyebrow "TUR {n} · {dates}" and title "Eksik kalanlar".
- Three stat tiles: eksik bölüm, kişi, okundu.
- An 11-column grid with the legend: okundu, eksik, senin payın, devralındı, havuz.
- Rows per owner:
  - "Sen": "Atanan 15–16 · Eksik 16. bölüm" with "Okundu işaretle".
  - Others and "Ortak havuz": "Üstlen".
- For Sekine (portion 19) the action opens the portion reader in cover mode for that round instead of marking directly.

Commit.

### Task 4.7: Home, Groups, Discover, inbox, reminders

- **Home:** `HomeGroupRow`'s button opens the portion reader on `myNextBabNumber` for HIZB, and the unit is bölüm.
- **Group cards:** `GroupCard` and `GroupProgressSummary` show "{read} / {partCount} {unit}".
- **Discover:** the Aylık filter.
- **Inbox:** rows pick the noun from `kind`.
- **Reminders:**
  - `reminderTotals` counts babs and portions separately.
  - The copy names babs, portions, or — when both are owed — "{n} okuman kaldı". Update the Reminders preview and the scheduler together, since both use `reminderTotals`.
  - Add tests in `utils/reminder.test.ts`.

Commit.

---

## Phase 5 — Reader

### Task 5.1: The Hizb portion reader with the Sekine counter

**Files:**
- `screens/Hizb/HizbReaderScreen.component.tsx`
- `HizbBody.component.tsx`
- `navigation/types.ts`

**Params:** `HizbReader: { sectionIndex: number } | { groupId: string; partNumber: number; roundIndex?: number }`. The free mode is unchanged.

**Portion mode:**
- It renders `portionBlocks(partNumber)` with `HizbBody`, paged by block as today.
- The eyebrow reads "Bölüm {n} / 33 · {work}", with the description below.
- The arrows walk 1..33 and only the *marking* is gated, as `BabReader` does:
  - ownership chip: mine, pool, other;
  - a hint line;
  - Okudum disabled for another member's portion;
  - a pool portion marks through take-then-read.
- The pull-to-refresh refreshes the group.

**Sekine** (`requiredRepetitions > 1`):
- A counter bar above the action bar: "{count} / 19", a "+1 tekrar" button, an undo, and a manual-entry sheet that sets the count directly, 0..19.
- Each change calls `useSetRepetitions` with an absolute count.
- Okudum stays disabled until the count reaches 19.
- The server remains the authority: a 409 rolls back the optimistic state and shows the message.

**Cover mode** (`roundIndex` below the current round): marking calls the cover endpoint for that round, and the counter reads and writes that round's count.

**Tests:** a pure helper `canMarkPortion({ ownership, required, count })` with a table test.

Commit.

---

## Phase 6 — Verification and docs

### Task 6.1: Full checks
1. `pnpm db:up`, then `pnpm test`, `pnpm check-types`, `pnpm lint` and `pnpm --filter @cuzhane/server build`. All green. Paste the counts in the report.
2. Seed a HIZB group per state:
   - GATHERING (owner, and a joined member)
   - full
   - RUNNING with a pool
   - a past round with misses
   - MONTHLY

   Extend `prisma/seed.ts` with a `kind` on the spec.
3. On the iOS simulator, walk HC1 → HC4 → HZ1 → HZ2 → HZ3 → HZ4 → HZ5, plus HJ1, HJ2 and HJ3. Compare each against the frame crops in the scratchpad, in light and dark mode.
4. Walk the Cevşen create, group, pool and rounds screens for regressions.
5. Test Sekine end to end: 18 refuses and 19 accepts, and the count survives closing the reader.

### Task 6.2: CLAUDE.md
Update:
- the domain model: kind, part count, MONTHLY, the per-portion Hizb pool and the repetitions rule;
- the Hizb text section: the 33-portion manifest and the slicing rule;
- remove the statement that how a group splits the Hizb is an open question.

Record the deviations listed at the top. Commit `docs: Hizb groups on the Cevşen model`.
