# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Layout

pnpm-workspaces monorepo with two apps:

- `apps/server` — Express 5 + TypeScript (ESM), Clerk auth, Prisma/PostgreSQL
- `apps/web` — Expo React Native client (iOS/Android/web) using Clerk Expo, TanStack Query, React Navigation

Root-level scripts live in the top `package.json`; run them from the repo root.

## Common Commands

From repo root:

- `pnpm server` — API dev server (`tsx watch`)
- `pnpm start` / `ios` / `android` / `web` — Expo dev client
- `pnpm dev:ios` / `dev:android` / `dev:web` — server + client in parallel
- `pnpm db:up` / `db:down` — local Postgres container
- `pnpm test` / `lint` / `format` / `check-types` — across both workspaces

Per workspace (`--filter @cuzhane/server` or `@cuzhane/web`):

- `pnpm --filter <pkg> check-types` — `tsc --noEmit`
- `pnpm --filter <pkg> test` — Vitest. Single file: `pnpm exec vitest run path/to/file.test.ts`
  **The server suite needs Postgres running (`pnpm db:up`).** `test/support/globalSetup.ts` creates a
  separate `cuzhane_test` database beside the dev one and runs `migrate deploy` into it, then
  `setupEnv.ts` repoints each worker's `DATABASE_URL` at it — so `@db/prisma` and the services under
  test hit the test database without any mocking. `assertIsTestDatabase` refuses to truncate a database
  whose name doesn't end in `_test`, which is the only thing standing between a misconfigured URL and
  your dev data; don't weaken it. Integration files truncate between tests, hence `fileParallelism: false`.
- Server build: `pnpm --filter @cuzhane/server build` (tsc + `tsc-alias` — TS path aliases are
  rewritten at build time, not runtime)
- Prisma: `pnpm --filter @cuzhane/server db:migrate｜db:generate｜db:studio｜db:seed`

## Domain model — read this before touching group logic

The Cevşen is **100 babs**. A group divides those 100 across its members.

- `Group` owns exactly 100 `GroupBab` rows, created up front in the same transaction as the group.
- `GroupBab` is the single source of truth for BOTH assignment (`assignedUserId`) and progress
  (`readByUserId` / `readAt`). A member's displayed range is **derived** from the babs assigned to
  them — never store a range on the member, or the two will drift.
- `GroupMember.slotIndex` is a stable 0-based seat. It caps membership at `Group.spots` and determines
  the member's block. Leaving frees the seat; the next joiner takes the lowest free one.
- Splitting 100 across `spots` seats: the first `100 % spots` seats get one extra bab. `rangeForSlot` /
  `babNumbersForSlot` in `utils/babs.ts` are the only place this math lives, and it is duplicated
  verbatim in `apps/web/src/lib/utils/babs.ts` — **change both together.** (`slotIndexForBab` is its
  inverse; the rotation helpers below live in the same pair of files.)
- **`splitMode` decides which block a seat reads on a given day, not which one it owns.**
  `ROTATION` (default) advances a seat by one whole seat per day — seat `s` reads seat
  `(s + dayIndex) % spots`. Advancing by a *block* rather than a fixed bab offset is what keeps the
  hundred tiled exactly when `spots` doesn't divide evenly. `FIXED` never moves. `FREE` is retired:
  the value survives in the DB enum because dropping one is destructive, but nothing can create it
  and `toSplitMode` reads such a row as `FIXED`.
- **Nothing stores who reads what.** A member's share is derived from their seat and the round —
  `shareBabNumbersToday` (server) or `GroupSummary.myBabNumbers` (client). Joining writes no bab rows
  and creating a group writes 100 bare ones. Never try to work out ownership from a column.
- **`GroupBab.assignedUserId` means exactly one thing: "I volunteered for this bab out of the pool,
  this round."** It is *not* seat ownership — it used to be both, and once the rotation moved the
  leftovers onto a member's old block the pool started reporting it as claimed by whoever had held
  that seat at join time. The rollover clears the whole column, so a non-null value always belongs to
  the round in progress. Reading never writes it; only volunteering does.
- **Lifecycle.** A group is `GATHERING` until the owner starts it: no `startedAt`, no day index, and
  nothing is counted. `startGroupForUser` stamps `startedAt` under a conditional `updateMany` guarded
  on `status: 'GATHERING'`, so a double tap can't rewind everyone's rotation. `autoStartIfFull` runs
  inside the join transaction when `autoStartWhenFull` is set, so the last joiner's own response
  already says RUNNING.
- **Shared pool.** The blocks nobody is reading this round, because their seat is empty. **The pool
  rotates too** — an empty seat `e` leaves uncovered the block it would have been reading,
  `(e + roundIndex) % spots`, not its own. Use `poolBlocks`; taking the standing block instead hands
  one bab to two people and makes another unreachable, so 100/100 becomes impossible. A slot is taken
  *whole*, sits on top of the taker's share, and **lasts one round**. A full group never has a pool.
- **A round boundary is a local midnight, in the group's own zone.** `Group.timezone` is the owner's
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
- **Rounds.** A group makes repeated passes at the hundred. `DAILY` rolls every day, `WEEKLY` every
  seven (`ROUND_DAYS` in `utils/rounds.ts`). Those are the only two cycles — every one of them rolls,
  so `ROUND_DAYS` is a `Record<CycleName, number>` with no null case, and `roundEndsAt` is always the
  next boundary rather than an end date for the group. (`ONE_OFF` and `OPEN_ENDED` were both removed;
  unlike `GroupSplitMode.FREE` these are gone from the DB enum too, each by its own migration.)
  **The board resets at the boundary whether or not it was finished** — the cycle is a promise about
  *when*, not about completing.
  `Group.roundIndex` is also the rotation index, so a WEEKLY group holds one range for the whole week.
- **The rollover is lazy, not scheduled.** There is no cron. `ensureCurrentRound` sits in front of
  every path that reads or writes a group, and the first request after a boundary performs the reset:
  clear the board, release pool claims, bump `roundIndex`, clear `completedAt`, recompute `endsAt`.
  It is guarded on the round being left, so two simultaneous requests can't both roll. A group nobody
  opens rolls when someone opens it — nothing observes a group except through these paths.
- **A closed round can still be covered, and covering it is append-only.** "Üstlen" (someone
  else's block or the pool) and "Okudum" (your own) are one write: `coverMissedBabForUser` inserts the
  `BabRead` row that round never had. It does **not** reopen the round, touch `GroupBab`, or move the
  read into the round now open — the unique key `(groupId, roundIndex, babNumber)` means a cover can
  only fill a gap, never displace whoever read it first (that returns 409). Covering the *open* round
  is refused with 403: the ordinary read paths own it, because they also keep the board and
  `completedAt` in step. Who *owed* a bab in a past round is derived, never stored —
  `owedSlotForBab` runs the rotation backwards — so a round shows both who owed each bab and who
  ended up reading it.
- **`GroupBab` is the current round; `BabRead` is the record.** The rollover wipes
  `GroupBab.readByUserId/readAt`, so anything historical — a member's total, their streak, the 30-day
  heatmap — must read `BabRead`, which is append-only and never cleared. Its unique key
  `(groupId, roundIndex, babNumber)` says a bab is read once per round. Every read/unread path writes
  it through `recordRead`; a new one must too, or the reset will quietly eat that history.
- `spots`, `splitMode` and `cycle` are immutable after creation.

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

- Entry: `src/index.ts` builds the app via `createApp()` in `src/app.ts`, and handles `SIGINT`/`SIGTERM`
  to disconnect Prisma.
- Middleware pipeline: `helmet` → `cors` → `express.json({ limit: '300kb' })` → `clerkMiddleware()`
  (session parse, non-rejecting) → routers.
- Public: `/health`. Everything else is under `/api` behind an auth gate + `populateAuthLocals`
  (populates `res.locals.auth`).
- Routes → services split: each `src/routes/*.route.ts` is a thin HTTP layer; logic lives in `src/services/*`.
- Validation: Zod schemas in `src/schemas/`, applied via `middleware/validate.middleware.ts`.
- Response shaping goes through `src/services/groupSerializers.ts` — routes must not hand raw Prisma
  rows to the client. Those serializer types mirror `apps/web/src/lib/types/domain.ts` field-for-field;
  the two workspaces share no package, so **changing one means changing the other.**
- ESM with TS path aliases (`@app`, `@config/*`, `@middleware/*`, `@routes/*`, `@schemas/*`,
  `@services/*`, `@db/*`, `@utils/*`, `@interfaces/*`). Dev uses `tsx`; the prod build relies on
  `tsc-alias --resolve-full-paths`. Strict options on: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- The Prisma schema is a **folder**, not a file: `prisma/schema/` holds `schema.prisma` (generator +
  datasource only) plus one file per domain — `group`, `membership`, `bab`, `user`. Prisma merges them, so
  models and enums are global across the folder regardless of which file they sit in; put a new model in
  the domain file it belongs to rather than starting another one. `prisma.config.ts` points `schema` at
  the folder — never back at a single file.
- Generated Prisma client output is `src/generated/prisma` (custom path in `prisma/schema/schema.prisma`,
  so its `output` is `../../src/generated/prisma`) and is gitignored — run `db:generate` after a fresh clone.

## Web Architecture (`apps/web`)

- Entry: `index.ts` → `src/AppRoot.tsx`. Provider order: `ClerkProvider` → `ThemeProvider` →
  `I18nProvider` → `QueryClientProvider` → `AppContainer` (`GestureHandlerRootView` → `KeyboardProvider`
  → `BottomSheetModalProvider` → `NavigationContainer`). Fonts load before render; splash held via
  `expo-splash-screen`.
- Navigation: `src/navigation/AppNavigator.tsx` — a 5-tab bottom navigator (Home, Groups, Discover,
  Reminders, Profile) inside a native stack. The stack's initial route is `Onboarding` until
  `userSettings.hasSeenOnboarding` is true, so the navigator waits for settings before mounting.
- **The bottom bar stays visible on every screen behind the tabs.** Home, Groups and Discover each own a
  stack (`sharedTabScreens()` registers `GroupDetail`, `BabReader`, the rounds screens and the Keşfet
  preview in all three), so detail screens push *inside* a tab and each tab keeps its own back stack. Adding a pushed
  screen means adding it to `sharedTabScreens`, not to the root stack — the root stack holds only
  `Onboarding`, `Tabs` and sheet routes. Tabs carry `popToTopOnBlur`, so leaving a tab resets it to its
  root — switching away from a group and back lands on the tab's list, not the group you were in. `TAB_BAR_HIDDEN_ROUTES` lists the exceptions (the reader);
  it also zeroes `TabBarOffsetContext`, so never hide the bar without going through it. Those screens
  **collapse** the bar (`BottomNavBar isCollapsed`), never unmount it: returning `null` from `tabBar`
  removed it the moment you navigated, which reflowed the screen being pushed away and flashed its card
  corner under the incoming one for a few frames.
- **The reader walks the member's share, not the hundred.** `BabReader`'s arrows, its progress rail and
  its "Bab 3 / 5" eyebrow all measure against `myBabNumbers`; stepping ±1 wandered into other members'
  babs, which are readable to look at but not to mark. The rail replaced a dash per bab because fifty
  dashes stopped reading as anything. `linking.ts` must keep `parse: { babNumber: Number }` — the share
  is matched by identity, so a string from a deep link is not found in it.
- The bottom bar is a **sibling below the scene, not an overlay** — the tab navigator already insets the
  screen by the bar's height. `TabBarOffsetContext` is therefore just a small content gap, not the bar's
  height; reserving the height again leaves a screenful of dead space under long content.
- Screens inside a tab type their navigation with `TabStackParamList`, not `RootStackParamList`.
- Home is a single-group view of "today's" round — the first entry from `useGetGroups()` (newest-first).
  Its primary action marks the reader's whole share at once via `PATCH /babs/:groupId/read-all`; don't
  replace that with a loop over the single-bab endpoint, which would fire one request per bab.
- Data layer: `src/api/wrapper.api.ts` attaches the Clerk bearer token; feature APIs in `src/api/*.api.ts`
  are wrapped by TanStack Query hooks in `src/lib/hooks/use*.ts`. `queryKeys.ts` centralises cache keys.
  `useSetBabRead` and `useUpdateUserSettings` are optimistic — preserve the cancel/snapshot/rollback
  pattern when editing them.
- Theme: token system in `src/lib/theme/tokens.ts`, light + dark. **Never hardcode a hex in a component** —
  every colour comes from `theme.colors.*` via `useThemeContext()`.
- i18n: `src/lib/i18n/strings.ts` holds the full TR/EN table; `useTranslation()` gives `t(key, values)`
  with `{token}` interpolation. TR is the default. **No user-facing string may be hardcoded** — add a key.
  `en` is typed as `typeof tr`, so a key added to one language fails the build until added to the other.
- Components: `src/components/<Name>/<Name>.component.tsx` + `<Name>.types.ts`, named exports only,
  `StyleSheet.create` at the bottom. All text goes through `components/ui/Typography` — no bare `<Text>`.
- **Icons**: every glyph comes from `components/ui/Icon` → `<Icon name size strokeWidth color />`, traced
  from the design system's `Icon Set.dc.html`. All are drawn on a 24 grid, render at 21px, inherit
  `currentColor` and carry **no fill** — activity is expressed by stroke weight (1.6 resting, 2.1 on the
  active tab), never by a filled variant, and nothing goes below 14px. Never use a typographic character
  (`←`, `×`, `+`, `›`, `✓`) as an icon — **including inside a string**: a label like `'Kopyalandı ✓'`
  smuggles one past the rule, so the tick belongs in `AppButton`'s `icon` prop and the string stays
  plain. The one exception the design keeps is the home ring's core mark (`۞`/`✓`), which is a
  Newsreader display glyph the size of a heading and is animated as text. Pushed screens get their back
  affordance from `ui/BackLink`.
- Avatars are DiceBear `thumbs` (`@dicebear/core` + `@dicebear/styles`), seeded on the person's name so
  they are stable, and re-tinted into the app palette — never DiceBear's default colours.
- **Screen titles**: every screen heads with `components/ScreenTitle` → `<ScreenTitle label secondaryLabel
description leading action size />`; pushed screens get it via `ScreenHeader`, which stacks a back row on
  top of the same block. It owns the design's `padding: 8px 0 18px`, so never hand-roll a heading or add
  padding around one — screens that did drifted apart and the title visibly jumped when switching tabs.
  `secondaryLabel` is the eyebrow above the label, `description` the caption below; `size` picks the three
  scales the design uses (`page` 27px, `name` 22px beside an avatar, `compact` 17px for Home's group name).
  The eyebrow row is **always laid out**, empty and at a fixed height, on screens without a
  `secondaryLabel` — that is what keeps every title on one baseline, so don't make it conditional.
  (`ScreenHeader` opts out via `hasReservedSecondaryLabel={false}`: its back row already fills that slot.)
- **Forms**: any screen that collects values goes through `components/ui/Form` → `<Form<T> schema
defaultValues render={({ handleSubmit, watch, setValue }) => …} />`, which wires `react-hook-form` to the
  zod resolver and puts the methods on context. Inside it use the bound controls — `Field` (text),
  `Switch`, `ToggleRow`, `OptionGroup` (choice cards), `Select` (cycle chips / segmented), `Stepper` — each
  binds by `name` and renders its own validation message. Don't hand-roll `useState` per input, and don't
  render your own error text under a bound control.
- Schemas live in `src/lib/schemas/*.schema.ts` and are **factories taking `t`** (`createGroupSchema(t)`),
  not module constants — validation messages are user-facing and this app is bilingual. Build them with
  `useMemo(() => createX(t), [t])`.
- Base inputs are `components/ui/Input` → `AppInput` and `components/ui/Switch` → `AppSwitch`, both mirroring
  React Native's own contracts (`value` / `onChangeText` / `onValueChange`) so the `Controller` wrappers can
  bind them. Use these directly only outside a `Form` (e.g. the Discover search box).
- Settings-style screens (Reminders) still use `Form`, but persist on change rather than submit — see the
  `ReminderPersistence` component there, which subscribes via `watch`'s callback form so it never fires on
  mount and never trips `react-hooks/set-state-in-effect`.
- **Bottom sheets**: every modal surface in the app is `components/ui/BottomSheet` → `AppBottomSheet`, so
  they all share one grabber, spring, fading backdrop and drag-to-dismiss. It's declarative — hold a state
  flag on the screen and pass `isVisible`. There is **no close button**: the grabber, a downward drag and a
  tap on the backdrop dismiss it; don't add an × back. Don't hand-roll a `Modal`, animate a sheet by hand,
  or reach for the navigator's `pageSheet` presentation. Share, Manage, reader text-size, member-removal,
  profile-photo, delete-account, feedback, members, join-by-code and create-group all use it.
- **The group screen's two whole-group actions are corner actions in its heading, and nothing else.**
  Owners get settings (which opens Yönet, and the members list from inside it) beside the filled Paylaş;
  non-owners get a members icon in that same slot, because they have no settings to open and the list is
  the one thing Yönet held for them. The old full-width "Yönet" button and the "Bu grupta kimler var" row
  are both gone — don't reintroduce either as a second way to the same place. `MembersSheet` is a sheet,
  not a route: `Members` was removed from `sharedTabScreens`, `TabDetailParamList` and `linking.ts`
  together. It takes a 52pt `topInset` because a list of twenty members genuinely runs long; the join
  flow deliberately does **not** — it sizes to its content like every other sheet, and a fixed detent
  there left a screenful of dead space under eight code cells.
- **An invitation is a code and nothing else.** There is no shareable URL anywhere — no QR, no
  `cuzhane://join/...`, no `https://cuzhane.app/j/...`, and `linking.ts` deliberately registers no invite
  path. The code is the hero of the share sheet and of the lobby, "Kodu kopyala" puts the bare (un-dashed)
  code on the clipboard, and it is typed back in on the other side. Don't reintroduce a link as a
  convenience: it was removed on purpose, and a second unadvertised way in is worse than none.
- Joining by code is therefore a **sheet, not a route** — `screens/Join/JoinByCodeSheet`, one surface
  holding all three steps (code entry → preview → group-full), opened over whatever screen you are on.
  It is mounted from Gruplarım's key button, Gruplarım's empty state and Home's empty state; Onboarding's
  "Davet kodum var" can't mount it directly, so it lands on the Groups tab with `shouldOpenJoinSheet` and
  that screen opens it. `screens/Join/InvitePreviewScreen` is still a pushed screen, because browsing
  Keşfet genuinely is navigation.
- A sheet that needs to be a *route* (create-group, which is reachable from two screens) registers under
  the `sheetRouteOptions` group — a `transparentModal` with `animation: 'none'`, because the sheet itself
  owns the animation. Pass `snapPoints` for content taller than the screen and `hasScrollableContent` when
  the body scrolls, so the sheet yields vertical gestures to it.
- **Motion**: the design doc is an HTML prototype and expresses motion as CSS. Translate intent, not
  syntax — `:hover` and `cursor:pointer` have no touch equivalent and become **press** feedback via
  `Pressable`'s `({ pressed })`. Real motion uses Reanimated. Eased colour/width transitions already live
  inside `ProgressBar`, `CellGrid` and `BabRow`'s checkbox, so callers get them for free; don't reimplement
  them per screen.
- The square-lattice UI (100-bab board, spots picker, activity heatmap) all builds on the single
  `components/ui/CellGrid` primitive, which derives cell size from measured width. Don't reintroduce
  percentage-based grid sizing — it drifts a pixel per column.
- Environment: `EXPO_PUBLIC_API_URL` (localhost auto-resolves to the Metro host for devices) and
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Path alias: `@/*` → `src/*`.

## Content gap

`src/lib/content/cevsen.ts` ships 100 bab entries with **empty** `arabic` fields — the Cevşen text is not
bundled. The reader renders the `readerMissing` string for any empty bab. Do not generate, transliterate
or approximate this text; it must be supplied from an authoritative source.

## Cross-Cutting

- Auth: Clerk is the source of truth in both apps. Server needs `CLERK_PUBLISHABLE_KEY` +
  `CLERK_SECRET_KEY`; client needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Shared versions (`package.json` `overrides`): `react`/`react-dom` pinned to `19.1.0`,
  `@react-navigation/native` to `7.2.2`.
- Formatting: Prettier, tabs, width 120, single quotes, no trailing commas. ESLint 9 flat configs per app.
- `design-reference.html` at the repo root is the original design doc every screen was built from.
  Treat it as the spec when changing screen layout.
