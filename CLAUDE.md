# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Layout

pnpm-workspaces monorepo with two apps:

-   `apps/server` — Express 5 + TypeScript (ESM), Clerk auth, Prisma/PostgreSQL
-   `apps/web` — Expo React Native client (iOS/Android/web) using Clerk Expo, TanStack Query, React Navigation

Root-level scripts live in the top `package.json`; run them from the repo root.

## Common Commands

From repo root:

-   `pnpm server` — API dev server (`tsx watch`)
-   `pnpm start` / `ios` / `android` / `web` — Expo dev client
-   `pnpm dev:ios` / `dev:android` / `dev:web` — server + client in parallel
-   `pnpm db:up` / `db:down` — local Postgres container
-   `pnpm test` / `lint` / `format` / `check-types` — across both workspaces

Per workspace (`--filter @cuzhane/server` or `@cuzhane/web`):

-   `pnpm --filter <pkg> check-types` — `tsc --noEmit`
-   `pnpm --filter <pkg> test` — Vitest. Single file: `pnpm exec vitest run path/to/file.test.ts`
    **The server suite needs Postgres running (`pnpm db:up`).** `test/support/globalSetup.ts` creates a
    separate `cuzhane_test` database beside the dev one and runs `migrate deploy` into it, then
    `setupEnv.ts` repoints each worker's `DATABASE_URL` at it — so `@db/prisma` and the services under
    test hit the test database without any mocking. `assertIsTestDatabase` refuses to truncate a database
    whose name doesn't end in `_test`, which is the only thing standing between a misconfigured URL and
    your dev data; don't weaken it. Integration files truncate between tests, hence `fileParallelism: false`.
-   Server build: `pnpm --filter @cuzhane/server build` (tsc + `tsc-alias` — TS path aliases are
    rewritten at build time, not runtime)
-   Prisma: `pnpm --filter @cuzhane/server db:migrate｜db:generate｜db:studio｜db:seed`

## Domain model — read this before touching group logic

The Cevşen is **100 babs**. A group divides those 100 across its members.

-   `Group` owns exactly 100 `GroupBab` rows, created up front in the same transaction as the group.
-   `GroupBab` is the single source of truth for BOTH assignment (`assignedUserId`) and progress
    (`readByUserId` / `readAt`). A member's displayed range is **derived** from the babs assigned to
    them — never store a range on the member, or the two will drift.
-   `GroupMember.slotIndex` is a stable 0-based seat. It caps membership at `Group.spots` and determines
    the member's block. Leaving frees the seat; the next joiner takes the lowest free one.
-   Splitting 100 across `spots` seats: the first `100 % spots` seats get one extra bab. `rangeForSlot` /
    `babNumbersForSlot` in `utils/babs.ts` are the only place this math lives, and it is duplicated
    verbatim in `apps/web/src/lib/utils/babs.ts` — **change both together.** (`slotIndexForBab` is its
    inverse; the rotation helpers below live in the same pair of files.)
-   **`splitMode` decides which block a seat reads on a given day, not which one it owns.**
    `ROTATION` (default) advances a seat by one whole seat per day — seat `s` reads seat
    `(s + dayIndex) % spots`. Advancing by a _block_ rather than a fixed bab offset is what keeps the
    hundred tiled exactly when `spots` doesn't divide evenly. `FIXED` never moves. `FREE` is retired:
    the value survives in the DB enum because dropping one is destructive, but nothing can create it
    and `toSplitMode` reads such a row as `FIXED`.
-   **Nothing stores who reads what.** A member's share is derived from their seat and the round —
    `shareBabNumbersToday` (server) or `GroupSummary.myBabNumbers` (client). Joining writes no bab rows
    and creating a group writes 100 bare ones. Never try to work out ownership from a column.
-   **`GroupBab.assignedUserId` means exactly one thing: "I volunteered for this bab out of the pool,
    this round."** It is _not_ seat ownership — it used to be both, and once the rotation moved the
    leftovers onto a member's old block the pool started reporting it as claimed by whoever had held
    that seat at join time. The rollover clears the whole column, so a non-null value always belongs to
    the round in progress. Reading never writes it; only volunteering does.
-   **Joining a seat releases whatever was volunteered for it.** A claim means "I'll cover for an empty
    seat this round"; filling the seat ends the errand, so `attemptJoin` clears `assignedUserId` across
    the block that seat is offering — via `poolBlockFor`, the same helper the pool itself uses, so the
    two can't disagree about which block a seat offers. Left standing, the claim stranded the volunteer:
    the block stops being pool once the seat is filled and was never their own seat's, so `setBabRead`
    refused it as "not yours to mark today" while their share still listed it — and the joiner was handed
    the same babs, because a share is derived from seat + round and knows nothing about claims. **Reads
    already made are never touched**: they happened, and `BabRead` keeps them. Only the claim comes off.
-   **Lifecycle.** A group is `GATHERING` until the owner starts it: no `startedAt`, no day index, and
    nothing is counted. `startGroupForUser` stamps `startedAt` under a conditional `updateMany` guarded
    on `status: 'GATHERING'`, so a double tap can't rewind everyone's rotation. `autoStartIfFull` runs
    inside the join transaction when `autoStartWhenFull` is set, so the last joiner's own response
    already says RUNNING.
-   **Shared pool.** The blocks nobody is reading this round, because their seat is empty. **The pool
    rotates too** — an empty seat `e` leaves uncovered the block it would have been reading,
    `(e + roundIndex) % spots`, not its own. Use `poolBlocks`; taking the standing block instead hands
    one bab to two people and makes another unreachable, so 100/100 becomes impossible. A slot is taken
    _whole_, sits on top of the taker's share, and **lasts one round**. A full group never has a pool.
-   **A round boundary is a local midnight, in the group's own zone.** `Group.timezone` is the owner's
    IANA zone, captured at creation and immutable after it. All the zone-aware math lives in
    `utils/rounds.ts` and is **server-only** — the client is handed a `roundIndex` and never computes
    one, which is why `roundIndexSince`/`roundStartedAtFor` were moved out of `utils/babs.ts` and are
    deliberately absent from its web mirror. The zone belongs to the group, not the member: a shared
    board needs one shared day or two members disagree about whose reads the rollover may wipe. Personal
    stats are the opposite case — `profile.service.ts` buckets the streak and heatmap in the **viewer's**
    zone, sent per request. Day arithmetic goes through `civilDayNumber`/`startOfCivilDay`, which read
    the wall-clock date via `Intl` rather than adding hours; that is what keeps a 23- or 25-hour DST day
    counting as one day. Never reintroduce `Date.UTC(...getUTCDate())` bucketing — it put the reset at
    20:00 the previous evening in New York.
-   **Rounds.** A group makes repeated passes at the hundred. `DAILY` rolls every day, `WEEKLY` every
    seven (`ROUND_DAYS` in `utils/rounds.ts`). Those are the only two cycles — every one of them rolls,
    so `ROUND_DAYS` is a `Record<CycleName, number>` with no null case, and `roundEndsAt` is always the
    next boundary rather than an end date for the group. (`ONE_OFF` and `OPEN_ENDED` were both removed;
    unlike `GroupSplitMode.FREE` these are gone from the DB enum too, each by its own migration.)
    **The board resets at the boundary whether or not it was finished** — the cycle is a promise about
    _when_, not about completing.
    `Group.roundIndex` is also the rotation index, so a WEEKLY group holds one range for the whole week.
-   **The rollover is lazy, not scheduled.** There is no cron. `ensureCurrentRound` sits in front of
    every path that reads or writes a group, and the first request after a boundary performs the reset:
    clear the board, release pool claims, bump `roundIndex`, clear `completedAt`, recompute `endsAt`.
    It is guarded on the round being left, so two simultaneous requests can't both roll. A group nobody
    opens rolls when someone opens it — nothing observes a group except through these paths.
-   **A closed round can still be covered, and covering it is append-only.** "Üstlen" (someone
    else's block or the pool) and "Okudum" (your own) are one write: `coverMissedBabForUser` inserts the
    `BabRead` row that round never had. It does **not** reopen the round, touch `GroupBab`, or move the
    read into the round now open — the unique key `(groupId, roundIndex, babNumber)` means a cover can
    only fill a gap, never displace whoever read it first (that returns 409). Covering the _open_ round
    is refused with 403: the ordinary read paths own it, because they also keep the board and
    `completedAt` in step. Who _owed_ a bab in a past round is derived, never stored —
    `owedSlotForBab` runs the rotation backwards — so a round shows both who owed each bab and who
    ended up reading it.
-   **`GroupBab` is the current round; `BabRead` is the record.** The rollover wipes
    `GroupBab.readByUserId/readAt`, so anything historical — a member's total, their streak, the 30-day
    heatmap — must read `BabRead`, which is append-only and never cleared. Its unique key
    `(groupId, roundIndex, babNumber)` says a bab is read once per round. Every read/unread path writes
    it through `recordRead`; a new one must too, or the reset will quietly eat that history.
-   `spots`, `splitMode` and `cycle` are immutable after creation.

Concurrency: claiming a bab and taking a pool slot both use a conditional `updateMany` guarded on
`assignedUserId: null` and check `count === 0` — two simultaneous claims cannot both win. Seat
allocation relies on the `@@unique([groupId, slotIndex])` constraint as the final guard, and starting
a hatim is guarded on `status: 'GATHERING'` the same way.

Undoing a read only ever clears rows where `readByUserId` is the caller. Under ROTATION a bab in
today's share may already have been read by whoever held that block yesterday, and today's holder
must not be able to erase it.

`completedAt` must always agree with the board. Every write that can change read state — single bab,
bulk "read my whole share", releasing a pool slot, removing a member, and account deletion — runs
`syncCompletedAt` **in the same transaction**, and that helper decides from a live count rather than a
previously-read value. Don't split the bab write from the sync, and don't pass it a stale `completedAt`.

`syncCompletedAt` takes `SELECT … FOR UPDATE` on the group row **before** counting, so the group row is
the serialisation point for every read-state write. Postgres runs on READ COMMITTED: without the lock,
two members finishing the last two babs at the same moment each count while the other's write is still
uncommitted, each sees one bab outstanding, and neither stamps the round complete — and with every bab
now read there is no later write to correct it. Measured on the dev database: **19/20 concurrent
finishes missed the stamp without the lock, 0/30 with it.** Don't remove it, and keep new read-state
paths going through this helper rather than counting on their own.
(Account deletion is the exception and doesn't need the lock — it clears the stamp with a single
conditional `updateMany` whose subquery is evaluated atomically.)

Deleting an account (`account.service.ts`) removes groups the user OWNS (the schema cascades their
members/babs/cheers/waitlist), frees their babs in groups they merely JOINED, drops their memberships,
cheers, waitlist entries, push tokens, settings and feedback — then clears `completedAt` on any joined
group that is no longer complete. The client must call this endpoint **before** `user.delete()`; deleting
the Clerk user first leaves the API call unauthenticated and strands the rows.

`Feedback` ("Geliştiricilere yaz", `feedback.service.ts`) stores a topic and a message, and **attaches
everything else itself** — the account email is read from Clerk at submit time, and the client sends its
own platform/version/locale without asking. The design deleted the email row and the diagnostics toggle
for exactly that reason; don't put either back as a question. The lookup is best effort: Clerk being
unreachable stores a null address rather than losing a message someone has already written. `reference`
is the sender's only handle on their message — `CV-` plus four characters from the invite alphabet,
rendered as `#CV-4K2P`, allocated with a uniqueness retry like `reserveInviteCode`.

Orphaned on purpose: the design removed the "Mâşallah" cheer button from the members list, so
`Cheer` (model, service, route, `cheers.api.ts`, `useCheer.ts`) is complete and working but currently
unreferenced by any screen. Left in place rather than dropping a DB table over a UI tweak.

The waitlist ("Bana haber ver" on a full group) was removed on request: its screen toggle, hook,
client API, route, schema, serializer field (`onWaitlist`) and `waitlist.service.ts` are all gone, so
nothing can create a `GroupWaitlistEntry` any more. The **model and table remain** — dropping them needs
a destructive migration — as do the two `deleteMany` cleanups (account deletion, joining a group) that
tidy up any rows left from before. Re-adding the feature means rebuilding that surface, not the schema.

## Server Architecture (`apps/server`)

-   Entry: `src/index.ts` builds the app via `createApp()` in `src/app.ts`, and handles `SIGINT`/`SIGTERM`
    to disconnect Prisma.
-   Middleware pipeline: `helmet` → `cors` → `express.json({ limit: '300kb' })` → `clerkMiddleware()`
    (session parse, non-rejecting) → routers.
-   Public: `/health`. Everything else is under `/api` behind an auth gate + `populateAuthLocals`
    (populates `res.locals.auth`).
-   Routes → services split: each `src/routes/*.route.ts` is a thin HTTP layer; logic lives in `src/services/*`.
-   Validation: Zod schemas in `src/schemas/`, applied via `middleware/validate.middleware.ts`.
-   Response shaping goes through `src/services/groupSerializers.ts` — routes must not hand raw Prisma
    rows to the client. Those serializer types mirror `apps/web/src/lib/types/domain.ts` field-for-field;
    the two workspaces share no package, so **changing one means changing the other.**
-   ESM with TS path aliases (`@app`, `@config/*`, `@middleware/*`, `@routes/*`, `@schemas/*`,
    `@services/*`, `@db/*`, `@utils/*`, `@interfaces/*`). Dev uses `tsx`; the prod build relies on
    `tsc-alias --resolve-full-paths`. Strict options on: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
-   The Prisma schema is a **folder**, not a file: `prisma/schema/` holds `schema.prisma` (generator +
    datasource only) plus one file per domain — `group`, `membership`, `bab`, `user`. Prisma merges them, so
    models and enums are global across the folder regardless of which file they sit in; put a new model in
    the domain file it belongs to rather than starting another one. `prisma.config.ts` points `schema` at
    the folder — never back at a single file.
-   Generated Prisma client output is `src/generated/prisma` (custom path in `prisma/schema/schema.prisma`,
    so its `output` is `../../src/generated/prisma`) and is gitignored — run `db:generate` after a fresh clone.

## Web Architecture (`apps/web`)

-   Entry: `index.ts` → `src/AppRoot.tsx`. Provider order: `ClerkProvider` → `ThemeProvider` →
    `I18nProvider` → `QueryClientProvider` → `AppContainer` (`GestureHandlerRootView` → `KeyboardProvider`
    → `BottomSheetModalProvider` → `NavigationContainer`). Fonts load before render; splash held via
    `expo-splash-screen`.
-   Navigation: `src/navigation/AppNavigator.tsx` — a 5-tab bottom navigator (Home, Groups, Discover,
    Reminders, Profile) inside a native stack. The stack's initial route is `Onboarding` until
    `userSettings.hasSeenOnboarding` is true, so the navigator waits for settings before mounting.
-   **The bottom bar stays visible on every screen behind the tabs.** Home, Groups and Discover each own a
    stack (`sharedTabScreens()` registers `GroupDetail`, `BabReader`, the rounds screens and the Keşfet
    preview in all three), so detail screens push _inside_ a tab and each tab keeps its own back stack. Adding a pushed
    screen means adding it to `sharedTabScreens`, not to the root stack — the root stack holds only
    `Onboarding`, `Tabs` and sheet routes. Tabs carry `popToTopOnBlur`, so leaving a tab resets it to its
    root — switching away from a group and back lands on the tab's list, not the group you were in.
    `TAB_BAR_HIDDEN_ROUTES` lists the screens the bar steps aside for, and it also zeroes
    `TabBarOffsetContext`, so never hide the bar without going through it. It is **currently empty**: the
    reader was the one entry, on the grounds that reading should be immersive, and is being tried with the
    bar left in. A screen that keeps the bar must not inset its own `bottom` safe-area edge — the bar is a
    sibling below it and already clears the home indicator, and doing both stacks two gaps (which is exactly
    what opened up under `BabReader`'s action bar). Listed screens **collapse** the bar (`BottomNavBar
isCollapsed`), never unmount it: returning `null` from `tabBar` removed it the moment you navigated, which
    reflowed the screen being pushed away and flashed its card corner under the incoming one for a few frames.
-   **Reduce Transparency is the system's business — no component checks it.** UIKit's and SwiftUI's
    own materials already respond to that setting, so a check of our own duplicates the OS and
    duplicates it worse: we don't get a more opaque control, we lose the native control entirely.
    Four components used to check it (`GlassSurface` and therefore every bottom sheet,
    `GlassBackLink`, `CreateGroupStepHeader`, `GlassCornerAction`) and four never did (`AppButton`,
    `AppSwitch`, `SegmentedControl`, `ReaderSizeSlider`) — which with the setting on gave a sheet
    that went flat under controls that stayed glass. Settled by looking at it rather than by
    argument. `useReducedTransparency` was deleted with its last consumer; if the judgement is ever
    revisited it belongs in all eight places or none.
-   **The navigator's bar is where a screen's whole-screen actions live**, and three things about it
    are easy to undo. `GlassCornerAction` is one bare toolbar glyph, `ui/MenuAction` is a pull-down
    button (one glyph, several actions — Gruplarım's +), and both are handed to `headerRight`.
    -   **Register the bar in `AppNavigator`'s `options`, never from a screen's `setOptions` effect.**
        An effect runs after the screen's first commit, so the first frame you see has an empty bar
        and a later commit fills it — visible as the controls appearing a beat after the screen. The
        cost is that a header lives _outside_ the screen and can reach none of its state, and that is
        what `GroupsToolbar` and `GroupDetailToolbar` are for: they read the query cache the screen is
        already holding, and ask for a sheet through a **route param** (`GroupDetail.sheet`,
        `Groups.shouldOpenJoinSheet`) which the screen clears on dismissal.
    -   **Size a `Host` in a header; never `matchContents`.** It reports 0×0 until its native view has
        laid out, and React Navigation measures `headerRight` to size the capsule it draws around the
        items — so a screen being _pushed_ sized its bar against nothing and jumped once the Hosts came
        back. It hides itself: navigating _back_ always looks right, because that header was still
        mounted and measured long ago. There is nothing to measure anyway, since the `frame` modifier
        already pins the box; declare the same number on the React side. (`GlassButton` keeps
        `matchContents` legitimately — its width depends on a label. Nothing in a header should.)
    -   **A glyph that depends on a query needs a seed, or it visibly swaps.** `GroupDetailToolbar`
        picks settings-or-members from `isOwner`, and `useGetGroupById` is a different key from the
        shelf's, so it starts pending and an owner watched the members glyph turn into the gear. It
        seeds from `groupQueryKeys.groups()` via `getQueryData` — read off the cache rather than
        subscribing, which would fetch the whole shelf on a deep link to decide one glyph.
-   **The heading below that bar is `ScreenTitle`'s `isUnderNavigationBar`, not a padding.** Screens
    declare that they sit under a bar; the component owns the distance. It was a constant each call
    site applied, and Gruplarım declared the style and never passed it — so its title drew behind the
    toolbar while the group screen cleared it. The pushed-screen skeletons don't use `ScreenTitle`, so
    they still apply `SCREEN_TITLE_PADDING_UNDER_BAR` by hand and are the one place that can drift.
-   **The reader walks the whole hundred; only the _marking_ is gated.** `BabReader`'s arrows step ±1
    across 1–100, its eyebrow reads "Bab 87 / 100" and its rail spans the cevşen. It used to walk
    `myBabNumbers` instead — arrows skipping 17→34, an eyebrow reading "Bab 3 / 5" — which did stop anyone
    marking a bab that wasn't theirs, but only by making the other ninety-five unreachable. E2 moved the
    guard onto the thing that actually belongs to someone: an **ownership chip** beside the bab name
    (`ownMine` / `ownPool` / `ownOther`, coloured `accentSoft` / `sand` / `secondary`), a one-line hint
    above the action bar, and a **disabled** Okudum reading `readLocked` for another member's bab. Disabled,
    not merely muted — most babs are somebody else's most days. Pool babs stay live and still route through
    `handleTakeAndRead`, because marking one claims it. The old full-width pool banner card is gone: the
    chip and the hint say it twice already. `linking.ts` must still keep `parse: { babNumber: Number }`.
-   **A verse ornament inside running Arabic is `۝` (ARABIC END OF AYAH) followed by its number —
    a character, never a drawn view.** React Native cannot place an inline `<View>` inside right-to-left
    text: the advance the line reserves and the frame the view is painted at disagree, so the rosette lands
    on top of words with a gap where its box was. It looks font-specific and isn't — measured across Nesih,
    Amiri and Şehrizad, every face broke on some babs and not others, purely on how that line's runs
    reorder. It only appeared at all once the reader was given a real Arabic font: the iOS system fallback
    never showed it, which is why this shipped fine before E2a. `۝` shapes and wraps with the words, so
    it cannot be misplaced, and all three faces enclose the digits that follow — Latin `1` as readily as
    Arabic-Indic `١`, so the numerals setting works either way. **Don't put a view back in that line.**
-   **`ui/Ornament` is the drawn rosette, and it is still right where a `View` is legal** — the mark that
    opens a bab and the settings preview's sample. Traced from the design system's Ornament Set page: eight
    r3 petals 5.4 out on a 26 grid and an r6.3 centre disc **filled with the page colour** (that disc is
    what cuts the petals into lobes, so `backgroundColor` must match whatever it sits on). The spec's r4.5
    dotted ring is deliberately dropped — at reading size its dashes and the numeral's strokes were the same
    weight and read as one texture. Colour is its own `theme.colors.ornament` token — `#A65D5D` light,
    `#C97B7B` dark — deliberately not `danger`, which is the deeper `#8C3F3F` in light mode. Its numeral is
    **SVG text on an explicit baseline**, not an overlaid `<Text>`: RN centres a text's _line box_, and Noto
    Naskh's digits don't sit at the centre of theirs, so overlaid they rode high in the rosette.
-   The bottom bar is a **sibling below the scene, not an overlay** — the tab navigator already insets the
    screen by the bar's height. `TabBarOffsetContext` is therefore just a small content gap, not the bar's
    height; reserving the height again leaves a screenful of dead space under long content.
-   Screens inside a tab type their navigation with `TabStackParamList`, not `RootStackParamList`.
-   Home is a single-group view of "today's" round — the first entry from `useGetGroups()` (newest-first).
    Its primary action marks the reader's whole share at once via `PATCH /babs/:groupId/read-all`; don't
    replace that with a loop over the single-bab endpoint, which would fire one request per bab.
    **"Whole share" means the rotated block _and_ the pool blocks they volunteered for** — the same set
    the serializer calls `myBabNumbers`, which is what the ring counts and offers to finish. It once
    covered only the rotated half, on the reasoning that a volunteered block is extra; the screen
    overruled that, since a tap on "33 bab · Bu grubu bitir" that moved seventeen of them read as
    nothing having happened.
-   Data layer: `src/api/wrapper.api.ts` attaches the Clerk bearer token; feature APIs in `src/api/*.api.ts`
    are wrapped by TanStack Query hooks in `src/lib/hooks/use*.ts`. `queryKeys.ts` centralises cache keys.
    `useSetBabRead` and `useUpdateUserSettings` are optimistic — preserve the cancel/snapshot/rollback
    pattern when editing them.
-   Theme: token system in `src/lib/theme/tokens.ts`, light + dark. **Never hardcode a hex in a component** —
    every colour comes from `theme.colors.*` via `useThemeContext()`.
-   i18n: `src/lib/i18n/strings.ts` holds the full TR/EN table; `useTranslation()` gives `t(key, values)`
    with `{token}` interpolation. TR is the default. **No user-facing string may be hardcoded** — add a key.
    `en` is typed as `typeof tr`, so a key added to one language fails the build until added to the other.
-   Components: `src/components/<Name>/<Name>.component.tsx` + `<Name>.types.ts`, named exports only,
    `StyleSheet.create` at the bottom. All text goes through `components/ui/Typography` — no bare `<Text>`.
-   **Icons**: every glyph comes from `components/ui/Icon` → `<Icon name size strokeWidth color />`, traced
    from the design system's `Icon Set.dc.html`. All are drawn on a 24 grid, render at 21px, inherit
    `currentColor` and carry **no fill** — activity is expressed by stroke weight (1.6 resting, 2.1 on the
    active tab), never by a filled variant, and nothing goes below 14px. Never use a typographic character
    (`←`, `×`, `+`, `›`, `✓`) as an icon — **including inside a string**: a label like `'Kopyalandı ✓'`
    smuggles one past the rule, so the tick belongs in `AppButton`'s `icon` prop and the string stays
    plain. The one exception the design keeps is the home ring's core mark (`۞`/`✓`), which is a
    Newsreader display glyph the size of a heading and is animated as text. Pushed screens get their back
    affordance from `ui/BackLink`.
-   Avatars are DiceBear `thumbs` (`@dicebear/core` + `@dicebear/styles`), seeded on the person's name so
    they are stable, and re-tinted into the app palette — never DiceBear's default colours.
-   **Screen titles**: every screen heads with `components/ScreenTitle` → `<ScreenTitle label secondaryLabel
description leading action size />`; pushed screens get it via `ScreenHeader`, which stacks a back row on
    top of the same block. It owns the design's `padding: 8px 0 18px`, so never hand-roll a heading or add
    padding around one — screens that did drifted apart and the title visibly jumped when switching tabs.
    `secondaryLabel` is the eyebrow above the label, `description` the caption below; `size` picks the three
    scales the design uses (`page` 27px, `name` 22px beside an avatar, `compact` 17px for Home's group name).
    The eyebrow row is **always laid out**, empty and at a fixed height, on screens without a
    `secondaryLabel` — that is what keeps every title on one baseline, so don't make it conditional.
    (`ScreenHeader` opts out via `hasReservedSecondaryLabel={false}`: its back row already fills that slot.)
-   **Forms**: any screen that collects values goes through `components/ui/Form` → `<Form<T> schema
defaultValues render={({ handleSubmit, watch, setValue }) => …} />`, which wires `react-hook-form` to the
    zod resolver and puts the methods on context. Inside it use the bound controls — `Field` (text),
    `Switch`, `ToggleRow`, `OptionGroup` (choice cards), `Select` (cycle chips / segmented), `Stepper` — each
    binds by `name` and renders its own validation message. Don't hand-roll `useState` per input, and don't
    render your own error text under a bound control.
-   Schemas live in `src/lib/schemas/*.schema.ts` and are **factories taking `t`** (`createGroupSchema(t)`),
    not module constants — validation messages are user-facing and this app is bilingual. Build them with
    `useMemo(() => createX(t), [t])`.
-   Base inputs are `components/ui/Input` → `AppInput` and `components/ui/Switch` → `AppSwitch`, both mirroring
    React Native's own contracts (`value` / `onChangeText` / `onValueChange`) so the `Controller` wrappers can
    bind them. Use these directly only outside a `Form` (e.g. the Discover search box).
-   Settings-style screens (Reminders) still use `Form`, but persist on change rather than submit — see the
    `ReminderPersistence` component there, which subscribes via `watch`'s callback form so it never fires on
    mount and never trips `react-hooks/set-state-in-effect`.
-   **Bottom sheets**: every modal surface in the app is `components/ui/BottomSheet` → `AppBottomSheet`, so
    they all share one grabber, spring, scrim and drag-to-dismiss. It's declarative — hold a state
    flag on the screen and pass `isVisible`. There is **no close button**: the grabber, a downward drag and a
    tap on the backdrop dismiss it; don't add an × back. Don't hand-roll a `Modal`, animate a sheet by hand,
    or reach for the navigator's `pageSheet` presentation. Share, Manage, reader text-size, member-removal,
    profile-photo, delete-account, feedback, members, join-by-code and create-group all use it.
-   **The sheet is the platform's own** — `UISheetPresentationController` on iOS, Material 3
    `ModalBottomSheet` on Android — through `@expo/ui/community/bottom-sheet`, whose API is a drop-in for
    `@gorhom/bottom-sheet`. **gorhom is uninstalled**; there is no JS-drawn fallback, no custom backdrop,
    no 26pt radius and no `BottomSheetModalProvider` in `AppRoot`. The surface, the scrim, the grabber and
    the corner radius are the OS's, deliberately — `backdropComponent`, `backgroundComponent` and
    `handleIndicatorStyle` are accepted by the wrapper but do nothing natively, so don't pass them.
    Three findings once said this was impossible and all three were fixed upstream: touches now reach the
    content (`RNHostView`), SwiftUI can measure it (`matchContents` + `fitToContents`), and Android
    forwards `containerColor` and can skip its half-height detent. `AppInput` no longer swaps in a
    sheet-aware `TextInput`, and `IsInsideSheetContext` is gone with it — an OS sheet moves itself for
    its own keyboard.
-   **Every sheet sizes to its content, and `snapPoints` is never passed to the platform.** A sheet that
    needs a fixed height gives its *content* one, via `AppBottomSheet`'s `heightRatio` (a fraction of the
    screen) — the members list is `0.75`, create-group `0.82`, everything else omits it and is as tall as
    it needs to be. `maxHeight` and `topInset` went with gorhom; they have no platform equivalent.
-   **Detents are not portable, which is why `heightRatio` exists.** iOS honours an arbitrary
    `presentationDetents` height; Android's Material 3 sheet has only two states — partial at about half,
    and expanded — so a single snap point is also the *last* one, resolves to expanded, and a `flex: 1`
    body fills the screen. The same `'82%'` gave 82% on iOS and 100% on Android. Sizing the content is the
    one instruction both platforms follow, since both size a sheet to what it holds.
-   **Never let `enableDynamicSizing` change on a live sheet** — which is now impossible, because it is
    hard-coded on. `BottomSheetView.swift` branches on `if props.fitToContents`, a *structural* SwiftUI
    `if`: flipping it swaps `_ConditionalContent` arms, so SwiftUI tears down one arm and builds the
    other, **taking the hosted React Native surface with it**, and everything inside remounts.
    Create-group learned this the expensive way — giving step 2 alone a detent re-presented the sheet
    instead of resizing it and remounted the `Form`, so the name and dedication reverted to their
    defaults entering step 2 and again on the way out, which then blocked creating the group at step 3.
-   **Create-group is therefore one fixed height for all three steps**, sized for step 2 (the tallest).
    Not only to avoid that remount: a fitted sheet's detent is assigned outside any animation
    transaction, so a sheet that changes height between steps *jumps*, and nothing in JS reaches that
    (`withAnimation` from `@expo/ui` only covers `useNativeState`). A sheet that never resizes has no
    transition to get wrong. Steps 1 and 3 carry some room below their last control; that is the accepted
    cost, and the alternative was tried and is worse.
-   **Sheets cannot stack**: iOS refuses to present one over another, which is why member-removal is a
    native `Alert` and why switching sheets on the group screen goes through a route param and a delay.
-   **The group screen's two whole-group actions are corner actions in its heading, and nothing else.**
    Owners get settings (which opens Yönet, and the members list from inside it) beside the filled Paylaş;
    non-owners get a members icon in that same slot, because they have no settings to open and the list is
    the one thing Yönet held for them. The old full-width "Yönet" button and the "Bu grupta kimler var" row
    are both gone — don't reintroduce either as a second way to the same place. `MembersSheet` is a sheet,
    not a route: `Members` was removed from `sharedTabScreens`, `TabDetailParamList` and `linking.ts`
    together. It takes a 52pt `topInset` because a list of twenty members genuinely runs long; the join
    flow deliberately does **not** — it sizes to its content like every other sheet, and a fixed detent
    there left a screenful of dead space under eight code cells.
-   **An invitation is a code and nothing else.** There is no shareable URL anywhere — no QR, no
    `cuzhane://join/...`, no `https://cuzhane.app/j/...`, and `linking.ts` deliberately registers no invite
    path. The code is the hero of the share sheet and of the lobby, "Kodu kopyala" puts the bare (un-dashed)
    code on the clipboard, and it is typed back in on the other side. Don't reintroduce a link as a
    convenience: it was removed on purpose, and a second unadvertised way in is worse than none.
-   Joining by code is therefore a **sheet, not a route** — `screens/Join/JoinByCodeSheet`, one surface
    holding all three steps (code entry → preview → group-full), opened over whatever screen you are on.
    It is mounted from Gruplarım's key button, Gruplarım's empty state and Home's empty state; Onboarding's
    "Davet kodum var" can't mount it directly, so it lands on the Groups tab with `shouldOpenJoinSheet` and
    that screen opens it. `screens/Join/InvitePreviewScreen` is still a pushed screen, because browsing
    Keşfet genuinely is navigation.
-   A sheet that needs to be a _route_ (create-group, which is reachable from two screens) registers under
    the `sheetRouteOptions` group — a `transparentModal` with `animation: 'none'`, because the sheet itself
    owns the animation. Pass `snapPoints` for content taller than the screen and `hasScrollableContent` when
    the body scrolls, so the sheet yields vertical gestures to it.
-   **Motion**: the design doc is an HTML prototype and expresses motion as CSS. Translate intent, not
    syntax — `:hover` and `cursor:pointer` have no touch equivalent and become **press** feedback via
    `Pressable`'s `({ pressed })`. Real motion uses Reanimated. Eased colour/width transitions already live
    inside `ProgressBar`, `CellGrid` and `BabRow`'s checkbox, so callers get them for free; don't reimplement
    them per screen.
-   **`Keyframe` is mutable — build one per animated element, never share a module constant.** `.delay()`
    writes to the instance and returns the same object, so a shared `const POP = new Keyframe(...)` used
    across a grid ends up carrying whatever delay the last cell asked for: every cell then animates on one
    schedule, which is no stagger at all and reads as "the animation doesn't work". `CellGrid`'s `pop()` /
    `shrink()` and `Stepper`'s `countPop()` are factories for exactly this reason.
-   **Grid motion follows `design_handoff_cuzhane/pool-fill.html`**, which is deliberate about _which_
    channel moves. The **pool fill** (üstlen, on the havuz board and the Turlar grid) is **colour only** —
    420ms a cell, no scale — because at forty cells a pop reads as noise while a colour sweep reads as
    ownership. The **spots picker** is the opposite: the cell _count_ changes there, so entrance and exit
    have to be legible, and it pops (380ms) and ghosts out (300ms) instead. Both stagger by a cell's index
    **within its own run** — `staggerWithinRuns` in `utils/groups.ts`, 70ms a step for the fill, 26ms for
    the seats. Timed from the start of the whole grid, a late block would still be filling seconds after
    the tap. Both honour `useReducedMotion`.
-   The square-lattice UI (100-bab board, spots picker, activity heatmap, pool board) all builds on the
    single `components/ui/CellGrid` primitive, which derives cell size from measured width. Don't
    reintroduce percentage-based grid sizing — it drifts a pixel per column.
-   **The cells ease their colours with a Reanimated CSS transition, never `useAnimatedStyle`.** A mapper
    per cell is what made the board unscrollable: measured on the group screen with RN's performance
    monitor, a fling held the **JS thread at 17–24fps and the UI thread at 35–40** with a hundred
    `useAnimatedStyle` cells, and **59–60 on both** once the same easing was declared as
    `transitionProperty`/`transitionDuration`/`transitionDelay` on a flat style object. Bisected by
    hiding the board (JS back to 60), then by removing the cells' `Pressable`s (no change — not the
    touch targets), then by swapping the animated style for a plain `View` (JS back to 60). The
    transition properties must sit on **one flat style object**, not inside a style array, or Reanimated
    never sees them. A transition also only animates a _change_, which is why the old `hasPainted`
    shared value — a hand-rolled guard so the first paint snapped instead of fading in from nothing —
    could go.
-   **A hundred cells is a lot of views, and both things that keep it cheap are easy to undo.** A `Cell`
    mounts a `Hatch` only if it is hatched _or has been_ — the stripes are eight rotated views apiece, so
    mounting one on every cell made three quarters of the board invisible scenery and it scrolled like it.
    Keeping the node after the hatch comes off is deliberate: that is what lets taking a pool bab fade the
    stripes out on the fill's own curve. And `Cell` is `memo`'d, which only pays if `items` and
    `onPressCell` hold their identity — build them with `useMemo`/`useCallback`, above the early returns
    where the screen has them (`GroupDetailScreen`, `RoundDetailScreen`). An inline `.map` in the JSX
    hands every cell a new object per render and silently restores the old cost.
-   **The pool board is `components/PoolGrid`, and there is exactly one of it.** Numbered cells in three
    states — hatched "havuzda", a soft panel for "başkası üstlendi", solid accent with a `text` ring for
    "sen üstlendin" — plus the matching three-item legend. The Havuz screen (07a/07b) and the group
    screen's Havuz card (07c) both render it, because the card is the door to the screen and two
    pictures of the same babs must not disagree. **07b is not a separate screen**: a crowded pool is the
    same board with more slots. The ring is a per-cell `borderColor` at a uniform `borderWidth`, not the
    design's outer `box-shadow` — `CellGrid` clips its cells, so an outset shadow would never show, and
    a uniform width keeps every cell the same size. Cells are always **sorted by bab number**: under
    ROTATION the slots arrive in rotated order, and the two surfaces build their cells from different
    sources (slots on the Havuz screen, the hundred via `toPoolCells` on the group screen), so without
    the sort the same pool would read in two different orders one tap apart.
-   **A share is one slice plus a count, never a list of ranges** (design 01g). Volunteering for a pool
    block gives a member a second, unconnected range, so "1–13, 27–39, 66–78" is now an ordinary share —
    and spelled out it wrapped Home's ring onto three lines and doubled the group heading. `shareSlices`
    in `utils/groups.ts` picks the stretch holding `myNextBabNumber` (where the reader actually is, not
    their lowest number) and counts the rest; `components/SliceChip` renders the "+2 aralık daha" chip.
    Three surfaces use the pair and must keep using it: Home's ring — where the chip lives _inside_ the
    flying range node so it rides the docking transform rather than being kept in step by hand — Home's
    shelf rows (`isCompact`, just "+2", because that column is 56pt), and the group screen's "Sana
    atanan" heading. `babRuns`/`formatRun` underneath live in the **mirrored** `utils/babs.ts` pair, so
    they change on both sides together.
-   **Üstlen can be undone, but only in the session that did it.** A row you claimed on this visit keeps
    an avatar _and_ a "Geri al" beside it, sub-lined "az önce üstlendin"; older claims don't, because by
    then it is a commitment other people can see rather than a slip. The state is deliberately memory
    (`takenHere` on the Havuz screen) and not a stored timestamp. The board **drains the block the way it
    filled, reversed** — last bab first, same `FILL_STEP_MS` — via `staggerWithinRuns`'s `reversedKeys`
    argument and `PoolGrid`'s `drainingSlotIndexes`. The draining slot is cleared on a timer sized to the
    sweep, or a later claim would play backwards too. Both the take and the release are optimistic: the
    sweep _is_ the confirmation, so it has to start on the tap, not on the response.
-   The Havuz screen's header counts **free** babs and **free** slots — what you could still take on —
    while the group screen's card chip counts the **whole** pool. Two questions, deliberately two
    numbers; `GroupInvitePreview.poolBabNumbers` is the whole pool too, `GroupSummary.poolBabNumbers`
    only the unclaimed part (it feeds the board, where a claimed bab is someone's work).
-   Environment: `EXPO_PUBLIC_API_URL` (localhost auto-resolves to the Metro host for devices) and
    `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
-   Path alias: `@/*` → `src/*`.

## The Cevşen text

`cevsen.data.json` holds the whole hundred — 100 babs, 999 invocations, a closing refrain each, and the
du'a that follows the hundredth. **Do not generate, transliterate or approximate any of it.** The reader
still renders `readerMissing` for an empty bab, which should now never happen.

It comes from the **Risale-i Nur Kütüphanesi** app (`org.feyyaz.Risale-iNur-Kutuphanesi`, FEYYAZ Bilim ve
Gelişim Derneği), which ships the Cevşen as a delimited text file rather than a scan — so this is the
publisher's own digital text, not something rebuilt from glyph geometry. That app is **available on Apple
Silicon Macs**, which is how it was read: install it, open the Cevşen once so it downloads, and the file
lands at `~/Library/Containers/org.feyyaz.Risale-iNur-Kutuphanesi/Data/Documents/kitaplar/cevsen/cevsen.txt`.
Its format is `#N` per bab, `~…|@` per line, `❁` between invocations; bab 1 carries the title and the
besmele, bab 100 carries the du'a as a third line. `meta` in the JSON records all of this.

It **replaced** an earlier extraction rebuilt from a PDF's per-character geometry. Two things made the
swap safe, and a future one should clear the same bar: the structures matched exactly (both sources give
100 babs and 999 invocations with identical per-bab counts, from wholly unrelated origins), and the du'a
acted as a control — it had already been pasted in by hand from this same app, and matched.

**The orthography is Ottoman/Turkish, and that is not incidental.** The long î is `U+06EA` plus yâ
(`رَح۪يمُ`) rather than a kasra — **549 of them across 70 of the 100 babs** — final yâ is dotless
(`وَلِىَّ`), and hamza sits on its Turkish carrier (`اَسْئَلُكَ`). The old PDF extraction had normalised all
of this to standard Arabic. Don't normalise it back: it is what this edition sets.

**The long î is `U+0656` (subscript alef), not the `U+06EA` the source file writes** — 549 of
them across 70 babs, converted at ingestion. This is worth knowing before "fixing" it back.
The publisher's file uses `U+06EA` (ARABIC EMPTY CENTRE LOW STOP) and then relies on its own
fonts to draw something else: **Osman Taha, the face that app actually renders with, maps
`U+06EA` straight onto its `uni0656` glyph**, and so do the other three it ships. So the
codepoint in the file is not what the edition prints — the glyph is, and that glyph is the
subscript alef. Any font not in on the arrangement renders `U+06EA` faithfully as the small
empty diamond its name describes, which is what Kitab, Amiri and Noto Naskh all did (2
contours, 0 curves, ~1:1). Writing the codepoint the edition _means_ fixes every face at once:
all three of ours carry `U+0656` as a zero-width curved stroke, Kitab's within a hair of the
reference (0.093×0.304 em against 0.080×0.254 em).

It also retired a workaround. KFGQPC gave `U+06EA` a **1442-unit advance and a 0.61 em body on
the baseline** — a black disc standing between words, at nearly verse-ornament size — so the
reader used to strip the mark for that face. Its `U+0656` is an ordinary zero-advance mark, so
`arabicFor` and its face set are gone. **`ornamentFaceFor` stays**: KFGQPC's `U+06DD` is still
a wide standalone rosette that the number sits beside, so Madinah still borrows Nesih for the
verse mark.

Nesih is the default. Medine Mushaf was briefly made the default and reverted, back when the
`U+06EA` stripping made it the wrong face to hand someone first.

## Notifications

The daily reminder is a **local** notification, scheduled on the device — one repeating
`DAILY` trigger, so the OS keeps firing it whether the app is backgrounded, force-quit or
never opened again. There is no server push; `PushToken` is stored but nothing sends to it.

`useReminderNotificationSync` is what makes that survive: the settings live on the server,
so a fresh install, a new device or a sign-in leaves the OS knowing nothing. It reconciles
on mount (hard reopen), whenever the settings or the counts change, and on every
`AppState` → `active` (soft reopen). `NotificationOrchestrator` mounts it in `AppRoot` — app
lifetime, not the Reminders tab's, because the schedule must be right whether or not anyone
opened that screen.

It compares **signatures** stored in the notification's own `data` rather than rescheduling
blindly: `triggerSig` (time + enabled) and `contentSig` (title + body). Cancelling and
re-adding on every launch leaves a window with nothing scheduled, and an app opened at the
moment the reminder was due would silently lose that day's notification. Only reminders
carrying this app's `kind` are ever cancelled.

Four rules the reconciler must keep — each of them was a real bug found in audit:

-   **Serialise runs, never drop them.** A request arriving mid-run sets a rerun flag and the
    loop goes round again, reading the desired state from a ref. Returning early instead meant
    that on a cold start — where settings and groups resolve moments apart — the first run
    cancelled (no group yet) and the second was discarded, leaving _nothing_ scheduled.
-   **Act only when the answer is known.** `isReady` needs both queries, or signed-out.
    Reconciling on settings alone cancels a good notification in the gap before groups arrive.
-   **Signed out is a known answer, not an unknown one.** It means "cancel". Otherwise the
    previous account's reminder — with their group's name in it — keeps arriving on a
    signed-out device, because clearing the cache leaves no successful query to reconcile.
-   **The reconciler reads permission and never requests it.** It runs on every launch, so
    prompting from there would throw the system dialog at someone who merely reopened the app.
    Two screens own the asking, and nothing else may: `HomeScreen` via
    `useNotificationPermissionPrompt` — once per session, and only when `canAskAgain` says a
    dialog would actually appear — and `RemindersScreen`, at the moment the switch is turned
    on. Home asks because it is the screen the reminder is _about_; onboarding would ask before
    any of it means anything.

The Android channel is declared inside `scheduleReminder`, immediately before the schedule
that needs it — from a mount effect it raced the first schedule, and Android silently drops
anything posted to a channel that doesn't exist yet.

The body's bab count is a **snapshot taken when it was scheduled** — a local notification's
text is fixed and nothing can recompute it at 21:30. Keeping the count in `contentSig` is
what keeps it honest: reading a bab re-syncs and replaces the pending notification. It can
only go stale if the reader progresses on another device.

**A repeating trigger fires at the next match, which may be tomorrow.** iOS resolves the
hour/minute against the next date _strictly after_ now, so a time already reached today is
scheduled for tomorrow — and because the picker write is debounced and round-trips the
server, choosing a time a minute out routinely lands a second or two past it. Diagnosed from
`PendingNotifications.plist` after a 09:29 reminder set at 09:29:02 never arrived and looked
broken. `isNextReminderTomorrow` in `utils/reminder.ts` puts that on screen under the picker
("İlk bildirim yarın 09:29"), which is the only thing distinguishing it from a reminder that
simply doesn't work. The `now` it compares against is refreshed on focus (`useIsFocused`,
adjusted during render), on foreground and on picking a time — a tab switch is none of the
others, and without the focus case the line kept claiming "bugün 09:52" at 09:54.

The picker's "Tamam" **closes the sheet and does not save.** The value is written on every
turn of the spinner and debounced 600ms, with a flush on blur and on unmount, so leaving
without tapping it keeps the time either way. It uses `confirm`, not `done` — `done` is the
lowercase mid-sentence "3 / 5 tamam" on the group screen.

**The reminder is about the day, not about one group.** `reminderTotals` in
`utils/reminder.ts` sums what is still owed across every running group and is shared by the
scheduler and the Reminders screen's preview, so the preview is the notification that will
actually arrive rather than an illustration of one. It returns three numbers, and the
difference between the last two is the whole point: `pendingGroups` (still owing) drives the
copy — past one group the body names the count, because a bare "26 babın kaldı" over six
groups reads as one group's — while `participatingGroups` (running, with a share, finished or
not) decides whether there is anything to say at all. Nothing to remind about is not the same
as having finished.

`setNotificationHandler` is set at module scope in `AppRoot`, before any component mounts —
without it a reminder arriving while the app is open is delivered silently.

## Push notifications

The daily reminder above is **local**. Separately there is now a **server push** path, for
things only the server can know about — the first is a pool claim released because somebody
joined the seat it was covering.

-   `push.service.ts` → `sendPushToUser(userId, payload)` fans out across the user's devices via
    `expo-server-sdk`, and **never throws**: callers reach it from inside domain flows where the
    write is the point and the push is a courtesy. It prunes `DeviceNotRegistered` tokens, which
    is the only receipt error meaning "stop trying" — kept, a stale token is retried forever.
-   Send **after the commit, never inside the transaction**, and `await` it rather than leaving
    it dangling: an unawaited rejection would escape the request as an unhandled one.
-   Copy lives in `utils/pushCopy.ts`, not the client's strings table — the phone is not involved
    in composing a notification it receives while closed. The language is resolved per send from
    `UserSettings`. That makes it a second, smaller copy table to keep in step by hand.
-   `usePushTokenRegistration` (in `NotificationOrchestrator`) registers this device's Expo token
    on sign-in and **withdraws it on sign-out** — left behind, the account's next notification
    arrives on a phone somebody else is now using. It only registers a device that already has
    permission; `registerDeviceForPush` is shared with the Home prompt so a newly-granted
    permission registers immediately rather than at the next launch.
-   A notification carrying a `groupId` in its `data` opens that group; the local reminder, which
    counts every group, still lands on Ana sayfa.
-   **A push is never the only channel.** `PoolClaimRelease` records the same event so the group
    screen can show it regardless — permission may be denied, the token may be missing, the phone
    may be off. Anything worth pushing is worth leaving a trace of.
-   **The simulator can register a token but cannot receive a real push.** `getExpoPushTokenAsync`
    succeeds there and the row lands in `PushToken`, which makes it look like the whole path
    works — it doesn't. APNs rejects that token with `BadDeviceToken` (400).
    **`"ios": { "simulator": true }` in the EAS profile does not help**: a simulator build is
    ad-hoc signed (`flags=0x2(adhoc)`) with no provisioning profile, and the `aps-environment`
    entitlement comes from the profile — so it has no push capability either. Verified by
    `codesign -d --entitlements - <app>` on both a local `expo run:ios` build and an EAS
    simulator build; neither has it. **Delivery needs a device build**: `eas device:create` to
    register the phone, `"simulator": false`, then `eas build --profile development -p ios`.
    Confirmed working that way — receipt `{"status":"ok"}`.
-   **A ticket is not a delivery.** `sendPushToUser` returning a count only means Expo _queued_
    the message. Failures like `BadDeviceToken` appear later in the **receipt**, fetched by ticket
    id from `/--/api/v2/push/getReceipts`. When a send looks successful and nothing arrives, the
    receipt is where the answer is — the sender does not currently poll them.
-   **What delivery actually needs is an APNs key on the Expo project.** Without one, Expo accepts
    the request and answers `InvalidCredentials` — "Could not find APNs credentials for
    com.cuzhaneapp.app (@devsc05/cuzhane)". Fix it once with `eas credentials -p ios` → _Push
    Notifications: Manage your Apple Push Notifications Key_; it needs the Apple Developer login,
    so it can't be scripted. **This is the first thing to check when a send silently does nothing.**
-   That error is also why `sendPushToUser` prunes on `DeviceNotRegistered` _specifically_ rather
    than on any error: a project-level misconfiguration must not delete every user's good token.
-   Two ways to test without waiting on Expo: `xcrun simctl push <device> <bundle-id> file.apns`
    posts a payload straight to the app, which verifies the receiving and tap-handling half; and
    calling `sendPushToUser` from a scratch script verifies the sending half against the real
    Expo API. Resetting notification permission to re-see the prompt needs an **uninstall and
    reinstall** — `simctl privacy` has no notifications service, and toggling it off in Settings
    sets _denied_, which the prompt deliberately skips.

There is **no account-wide notifications switch.** `UserSettings.notificationsEnabled` was
a column with an update endpoint and no control in any screen, so nothing ever wrote
anything but its `true` default — while a row holding `false` would have stopped every
reminder for good with the Reminders toggle still reading "on". It was dropped
(`20260828090000_drop_notifications_enabled`) from the schema, the zod body, the service,
the domain type and the API input. `reminderEnabled` is the only switch, because it is the
only one the app gives anybody a way to set; add a column back only alongside its UI.

## Cross-Cutting

-   Auth: Clerk is the source of truth in both apps. Server needs `CLERK_PUBLISHABLE_KEY` +
    `CLERK_SECRET_KEY`; client needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
-   Shared versions (`package.json` `overrides`): `react`/`react-dom` pinned to `19.1.0`,
    `@react-navigation/native` to `7.2.2`.
-   Formatting: Prettier, tabs, width 120, single quotes, no trailing commas. ESLint 9 flat configs per app.
-   `design-reference.html` at the repo root is the original design doc every screen was built from.
    Treat it as the spec when changing screen layout.
-   `design_handoff_cuzhane/` holds the designer's `.dc.html` exports, copied in **byte for byte** and
    listed in `.prettierignore` — a reformatted copy can't be diffed against the next export to see what
    actually changed. They are read as source, not opened: each one is a template needing the design
    tool's `support.js` runtime (and React from a CDN), neither of which is vendored here.
    `Ornament Set.dc.html` is the verse ornament's spec — grid, anatomy, the ١–١٢٠ set and the Kurallar.
