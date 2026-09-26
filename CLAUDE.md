# CLAUDE.md

Guidance for Claude Code in this repository. Rules and traps only; the code and its comments
carry the detail. **Never run commands against a deployed server** — anything that needs checking
or changing there is handed to the person you are working with. Operator-specific notes, if any,
live in a local, uncommitted `CLAUDE.local.md`.

## Repo

pnpm-workspaces monorepo:

-   `apps/server` — Express 5 + TypeScript (ESM), Clerk auth, Prisma/PostgreSQL.
-   `apps/web` — Expo (SDK 57) React Native client, iOS/Android/web: Clerk Expo, TanStack Query,
    React Navigation, Reanimated 4. **iPhone only** (`supportsTablet: false`).
-   `apps/marketing` — Astro static site: the public page, privacy and support.
-   `deploy/` — the server's compose stack and Caddyfile (`deploy/README.md`).

Root scripts live in the top `package.json`; run them from the repo root. Shared versions are pinned
in its `overrides` (`react`/`react-dom` 19.1.0, `@react-navigation/native` 7.2.2).

## Commands

-   `pnpm server` — API dev server (`tsx watch`). `pnpm start` / `ios` / `android` / `web` — Expo.
    `pnpm dev:ios|android|web` — both. `pnpm db:up` / `db:down` — local Postgres (port 5433).
-   `pnpm test` / `lint` / `format` / `check-types` — all workspaces.
-   Per workspace: `pnpm --filter @cuzhane/server|@cuzhane/web check-types|test`. One file:
    `pnpm exec vitest run path/to/file.test.ts`.
-   **Server tests need Postgres running.** `test/support/globalSetup.ts` creates `cuzhane_test` and
    runs `migrate deploy` into it; `setupEnv.ts` points every worker there. `assertIsTestDatabase`
    refuses to truncate a database not ending in `_test` — never weaken it. `fileParallelism: false`.
-   Prisma: `pnpm --filter @cuzhane/server db:migrate|db:generate|db:studio|db:seed`. **Never hand-write
    a migration**: `db:migrate --name …`, then `db:generate`. **Never run `prisma format`** — the
    schema files are 4-space indented and it rewrites them to 2; check with `prisma validate`. `db:seed` rebuilds the dev data (new
    group ids, which also resets the device's once-a-round "seen" flags).
-   Server build: `tsc` + `tsc-alias --resolve-full-paths` (path aliases are rewritten at build time).
-   Hüsrev pages and the Hatim duası: the images in `apps/server/mushaf/` are gitignored and not
    in the repository — nothing here regenerates them. Without them only the Hüsrev reader is empty.
-   Format: Prettier — tabs, width 120, single quotes, no trailing commas. `.astro` and
    `design_handoff_cuzhane/` are prettier-ignored.

## Branches, CI and deploy

-   **`development` is the default branch** and deploys **preview**; `main` deploys **production**.
    Feature PRs target `development`; releases go `development` → `main`.
-   `deploy-server.yml` runs on pushes to either branch that touch `apps/server/**`, `deploy/**` or
    the root package files: builds the image to GHCR, copies the deploy files onto the server, runs
    `up -d --wait`, smoke-tests. `deploy-marketing.yml` (main only) ships the Astro build.
-   One server runs Caddy, `api` (production), `api-preview` and one Postgres with two databases
    (`cuzhane`, `cuzhane_preview`). Secrets are never in the repo. Edit deploy files here, never on
    the server — CI overwrites them. Overview: `deploy/README.md`.
-   **Hüsrev page images are not in the repo or the image** (`apps/server/mushaf/`, gitignored, also
    in `.dockerignore`); the server mounts them read-only into both API containers at
    `/app/apps/server/mushaf`. A branch whose `.gitignore` predates them shows them as untracked —
    never discard them.
-   **Claude review workflow** (`claude-code-review.yml`, Opus 5.5): the action skips unless the PR's
    copy of the workflow file is byte-identical to the default branch's. Change it on `development`
    first, then bring the identical file onto the feature branch. It also skips a PR it already
    reviewed. A re-run replays the original commit's workflow file.

## Domain model — read before touching group logic

A group reads either the **Cevşen** (`kind: CEVSEN`, 100 babs split across seats) or the **Kur'an**
(`kind: HATIM`, 30 cüz held individually). Both live on `GroupBab` rows (100 or 30) and share the
round machinery. `unitCountFor(group)` answers "how many" — never write a literal 100.

**Cevşen**

-   `GroupMember.slotIndex` is a stable 0-based seat, capped at `spots`; the next joiner takes the
    lowest free seat. 100 split over `spots`: the first `100 % spots` seats get one extra bab.
    `rangeForSlot`/`babNumbersForSlot`/`slotIndexForBab` and the rotation helpers live in
    `utils/babs.ts`, **mirrored verbatim in `apps/web/src/lib/utils/babs.ts` — change both.**
-   **Nothing stores who reads what.** A share is derived from seat + round (`shareBabNumbersToday`,
    `GroupSummary.myBabNumbers`). `splitMode`: `ROTATION` (seat `s` reads block
    `(s + roundIndex) % spots`) or `FIXED`. `FREE` survives in the enum only; it reads as `FIXED`.
-   `GroupBab.assignedUserId` means only "I volunteered for this bab out of the pool, this round".
    It is never seat ownership. The rollover clears it. Joining a seat clears the claims on the block
    that seat offers (`poolBlockFor`); reads already made stay.
-   **Pool** = blocks nobody reads this round because their seat is empty. It rotates: empty seat `e`
    leaves block `(e + roundIndex) % spots` uncovered — use `poolBlocks`. A slot is taken whole, sits
    on top of the taker's share, lasts one round. A full group has no pool.
-   Undoing a read only clears rows whose `readByUserId` is the caller.

**Kur'an (hatim)**

-   Who holds a cüz is **stored**: `CuzHolding` (one holder per `(groupId, roundIndex, cuzNumber)`).
    Seat maths means nothing for a hatim — any "who owes/holds cüz N" must read `CuzHolding`
    (`holdingsFor`, `resolveUnitPlan` in `services/unitPlan.ts`). This was the source of real bugs.
-   `distribution` is `FREE_PICK` in practice: the owner picks at creation and joiners pick from the
    map. `EQUAL` / `JOIN_ORDER` survive in the enum only — nothing creates or implements them.
    `maxPerMember` caps holdings (server-side; no UI changes it after creation). `boundaryPolicy`: `KEEP` copies non-loan holdings
    forward at the boundary, `REPICK` resets the map.
-   `isLoan` = taken from the havuz mid-round; it lasts one round whatever the policy.
-   A member of a running hatim must hold a cüz to open the group (the round-start screen gates it);
    `CuzRoundSkip` records "sit this round out".
-   Leaving or deleting an account deletes the member's holdings for **every** round, so their
    past cüz read as unheld in history.

**Rounds (both kinds)**

-   Lifecycle: `GATHERING` (nothing counted, no `startedAt`) → `RUNNING`. Starting is a conditional
    `updateMany` on `status: 'GATHERING'`; `autoStartIfFull` runs inside the join transaction.
-   `roundDays` drives the calendar; `cycle` is the label: `DAILY`(1), `WEEKLY`(7), `MONTHLY`(30),
    `CUSTOM`. **A `CUSTOM` group never leaves round 0** — it is a length, not a cadence.
-   A round boundary is a **local midnight in the group's own `timezone`** (owner's zone, immutable).
    Zone maths is server-only, in `utils/rounds.ts` (`civilDayNumber`/`startOfCivilDay`, via `Intl`).
    Never bucket with `Date.UTC(...getUTCDate())`. Personal stats use the **viewer's** zone.
-   **The rollover is lazy.** No cron: `ensureCurrentRound(For)` sits in front of every read/write
    path; the first request after a boundary clears the board and pool claims, bumps `roundIndex`,
    clears `completedAt`. Guarded on the round being left. A new read path must call it too.
-   The board resets at the boundary whether or not it was finished.
-   **`GroupBab` is the current round; `BabRead` is the record** (append-only, unique
    `(groupId, roundIndex, babNumber)`). Anything historical reads `BabRead`. Every read/unread path
    writes through `recordRead`.
-   Covering a closed round is append-only (`coverMissedBabsForUser`): inserts the missing `BabRead`,
    409 if already covered, 403 for the open round and for rounds that closed before the member joined. Who owed what in a past round is derived
    (`owedSlotForBab` for Cevşen, `CuzHolding` for a hatim).
-   `spots`, `splitMode`, `cycle`, `kind` are immutable after creation.

**Invariants**

-   Claims and pool takes: conditional `updateMany` on `assignedUserId: null`, check `count === 0`.
    Seats: `@@unique([groupId, slotIndex])`. Holdings: the `CuzHolding` unique key.
-   **`completedAt` must agree with the board.** Every read-state write (single, read-all, releasing a
    slot, removing a member, account deletion) runs `syncCompletedAt` in the **same transaction**. It
    takes `SELECT … FOR UPDATE` on the group row before counting — without it, concurrent finishes
    miss the stamp (measured 19/20). Don't remove it; route new read-state paths through it. It
    returns whether this call closed the round.
-   Account deletion (`account.service.ts`) removes owned groups (cascade) and the user's rows
    elsewhere, then fixes `completedAt`. The client calls it **before** Clerk's `user.delete()`.
-   `Feedback` attaches the account email (from Clerk, best effort) and client diagnostics itself —
    don't add them back as questions. Reference: `CV-` + 4 invite-alphabet chars.
-   **A display name is never an email address** — `resolveDisplayName`, `nameOf` and the client's
    `useViewerIdentity` fall back to "Member". Names reach every member, and the owner's reaches
    anyone previewing an open group.
-   Group events (pool take, join, leave) are announced **once per actor, per round, per subject**
    via `GroupEventNotice` in `notifyGroupMembers` — a take/release or join/leave loop stays silent.
-   Unreferenced on purpose: `Cheer` (model, service, route, hooks) and the `GroupWaitlistEntry`
    table. Dropping either needs a destructive migration.

## Server (`apps/server`)

-   `src/index.ts` → `createApp()` (`src/app.ts`). Pipeline: `helmet` → `cors` → `express.json(300kb)`
    → `clerkMiddleware()` → routers.
-   **Public: `/health` only.** Everything else is under `/api` behind `requireAuthApi` +
    `populateAuthLocals`, including the mushaf page images (`/api/mushaf/*`, static, private cache).
-   Routes are thin (`src/routes/*.route.ts`); logic in `src/services/*`; Zod in `src/schemas/`
    via `validate.middleware.ts`. Id params are capped at 64 characters.
-   Per-user rate limits (`middleware/rateLimit.middleware.ts`) on join/leave/code lookup, creating a
    group, cheers, pool take/release, the verse meal, push-token registration and feedback. A new
    route that writes rows for other users or calls a third party gets one too.
-   Push tokens must pass `Expo.isExpoPushToken`; an account keeps its 10 most recent.
-   **Responses go through `services/groupSerializers.ts`** — never a raw Prisma row. Its types mirror
    `apps/web/src/lib/types/domain.ts` field for field; the workspaces share no package, so **change
    both together**.
-   ESM + aliases (`@app`, `@config/*`, `@middleware/*`, `@routes/*`, `@schemas/*`, `@services/*`,
    `@db/*`, `@utils/*`, `@interfaces/*`). Strict: `noUncheckedIndexedAccess`,
    `exactOptionalPropertyTypes`.
-   Prisma schema is a **folder** (`prisma/schema/`: `schema.prisma` + one file per domain); the client
    is generated to `src/generated/prisma` (gitignored — `db:generate` after cloning).
-   Env: `apps/server/.env` (see `.env.example`). `QURAN_CLIENT_ID/SECRET` are optional: without them
    the verse meal answers 503.

## Web (`apps/web`)

**Structure**

-   `index.ts` → `src/AppRoot.tsx`: `ClerkProvider` → `ThemeProvider` → `I18nProvider` →
    `QueryClientProvider` → `AppContainer` (`GestureHandlerRootView` → `SafeAreaProvider` →
    `KeyboardProvider` → `NavigationContainer`).
-   **`SafeAreaProvider` must stay at the app root** (`initialMetrics={initialWindowMetrics}`).
    Anything rendered outside a navigator (the settings gate's skeleton/error) crashes the release
    build without it. An "abort() called" crash on `expo.controller.errorRecoveryQueue` is a
    swallowed JS error — read the real exception from the device log.
-   Navigation (`navigation/AppNavigator.tsx`): native stack (`Onboarding`, `Tabs`, sheet routes) over
    a 5-tab native bottom navigator — Home, Groups, Discover, Notifications (inbox), and Search on iOS
    / Profil on Android. The account/search corner swaps by platform (`TrailingCornerAction`).
-   **Every tab owns a stack; pushed screens go in `sharedTabScreens()`**, never the root stack. Tabs
    `popToTopOnBlur`. Tab screens type navigation with `TabStackParamList`.
-   Hide the bottom bar only via `TAB_BAR_HIDDEN_ROUTES` (it also zeroes `TabBarOffsetContext`); listed
    screens collapse the bar, never unmount it. The bar is a sibling below the scene: a screen that
    keeps the bar must not inset its own bottom safe area.
-   `linking.ts`: every tab has `initialRouteName`; numeric params need `parse: { …: Number }`. Links
    wait for the tabs (`linkGate.ts`). The only emitted link is `cuzhane://groups/join/<CODE>` (the
    invite QR); `cuzhane://onboarding` replays onboarding.
-   **Bar actions are registered in `AppNavigator` `options`, never from a screen's `setOptions`
    effect** (first frame would be empty). Header components read the query cache and talk to the
    screen through route params (`GroupDetail.sheet`, `shouldOpenTextSize`, …). Size a `Host` in a
    header explicitly; never `matchContents` there.
-   Data: `api/wrapper.api.ts` attaches the Clerk token (and signs out on a missing one);
    `authorizationHeader()` for non-JSON requests. Feature APIs in `api/*.api.ts`, hooks in
    `lib/hooks/use*.ts`, keys in `queryKeys.ts`. `useSetBabRead` and `useUpdateUserSettings` are
    optimistic — keep the cancel/snapshot/rollback shape.
-   Path alias `@/*` → `src/*`.

**Conventions**

-   **No hardcoded colour** — `theme.colors.*` from `lib/theme/tokens.ts` (light + dark).
    `AppStatusBar` owns the status bar style; screens never set it.
-   **No hardcoded user-facing string** — `lib/i18n/strings.ts`, **TR / EN / NL** (`en`/`nl` typed as
    `typeof tr`, so a missing key fails the build). TR is the default.
-   Components: `components/<Name>/<Name>.component.tsx` + `<Name>.types.ts`, named exports,
    `StyleSheet.create` at the bottom. Text only through `components/ui/Typography`.
-   **Icons** only via `components/ui/Icon` (traced from the design's Icon Set, stroke only, 21px,
    ≥14px). **Never a typographic character as an icon**, not even inside a string. Beside a glass
    control use `ui/Icon/SymbolIcon` (a custom SF Symbol; new ones need a native build). An icon-only
    `AppButton` is always the 44pt nav-bar disc; glass only for icons in `GLYPH_BY_ICON`.
    `ICON_ONLY_GLYPH_SIZE` is mirrored in `Button.component.tsx` and `GlassButton.tsx`.
-   Every SwiftUI `Host` carries `ignoreSafeArea='keyboard'` on the host itself.
-   Headings: `components/ScreenTitle` (pushed screens via `ScreenHeader`); never hand-roll one or pad
    around it. `isUnderNavigationBar` for screens under a bar.
-   Forms: `components/ui/Form` + bound controls (`Field`, `Switch`, `ToggleRow`, `OptionGroup`,
    `Select`, `Stepper`); schemas are factories taking `t` (`createXSchema(t)`, memoised on `t`).
-   **Sections are glass via `components/ui/CardSurface` only** (`hasGlassSurface` defaults true;
    `false` for a card with its own fill). Don't override a card's `borderRadius`. Controls stay flat.
    No component checks Reduce Transparency.
-   A failed screen is `<ErrorState queries={[…]} />` (whole screen). Pull-to-refresh via
    `usePullToRefresh(...)` + `ui/PullToRefresh` (RN `RefreshControl` on iOS, Material box on Android;
    the list needs `nestedScrollEnabled`).
-   Avatars: DiceBear `thumbs`, seeded on the name, re-tinted into the palette.

**Sheets** — every modal is `components/ui/BottomSheet` → `AppBottomSheet` (the platform's own
sheet via `@expo/ui/community/bottom-sheet`; no gorhom, no close button):

-   Content paints its own ground (`theme.colors.sheet`). Sheets size to content; for a fixed height use
    `heightRatio`, never `snapPoints` (Android's sheet can't honour arbitrary detents).
-   **Never let `enableDynamicSizing` change on a live sheet** (it remounts the content). Create-group
    is one fixed height for all steps for that reason.
-   Sheets cannot stack on iOS — switch via a route param and a delay; member removal is an `Alert`.
-   A sheet that must be a route registers under `sheetRouteOptions` (`transparentModal`,
    `animation: 'none'`).

**Motion and grids**

-   Motion is Reanimated. Prefer CSS keyframes/transitions over `entering`/`exiting`. Transition
    properties must sit on **one flat style object**, not a style array.
-   **`Keyframe` is mutable** — build one per animated element (factories), never a shared constant.
-   Grids (board, spots picker, heatmap, pool) use `components/ui/CellGrid` (sizes from measured width).
    **Cells ease colour with a CSS transition, never `useAnimatedStyle`** (it made the board
    unscrollable). Mount `Hatch` only on cells that are/were hatched; keep `items`/`onPressCell`
    identity-stable (`useMemo`/`useCallback` above early returns).
-   Pool fill is colour-only, staggered within runs (`staggerWithinRuns`); honour `useReducedMotion`.
-   `components/PoolGrid` is the one pool board; cells sorted by bab number.
-   A share is shown as one slice plus a count (`shareSlices` + `SliceChip`), never a list of ranges.

**Readers**

-   **Cevşen reader** (`BabReader`, free reader `AllBabs`): walks all 100; only marking is gated by
    ownership. A verse mark in running Arabic is the character `۝` + number — **never an inline
    `View`** (RN misplaces views in RTL text). `ui/Ornament` is the drawn rosette for standalone use.
    Every nested span in `ReaderBody` re-declares the paragraph's `lineHeight`: Android measured the
    du'a by a span's 21pt `Typography` line and clipped everything past it.
-   **Kur'an reader** (`CuzReader`): two modes by the saved `readerArabicFont`.
    -   Typeset (`MushafPage`): Madinah text from the Quran Foundation, bundled; sajdah verses from the
        text's own `۩`; band positions computed (`rowBands`), not measured. A nested text span must
        re-declare `lineHeight`. Long-press opens the verse meal (live `GET /api/quran/translation`,
        Diyanet 77 / Saheeh 20 / Siregar 144).
    -   **Hüsrev** (`husrev`, not a font — `textFontFor` maps it for text): the edition's page images via
        `MushafImagePage` + `useMushafPage` (download once to the cache, `.part` then move, prefetch
        next; token only when downloading; web draws from a blob URL). Pages are keyed by **path**
        (`mushafPagePath`, `MUSHAF_DUA_PATHS`). The old page stays until the new one draws, then the
        reader scrolls to top (`onShown`). The header sits above the scroll view, not sticky.
        `SecdeOrnament` floats fixed over the scroll view on sajdah pages (drag vertical, tap scrolls
        to the green). Hüsrev's cüz are its own 20 pages (cüz 1 is 21, cüz 30 is 24).
-   Hatim duası (`HatimDuaScreen`): the edition's four Hüsrev pages only, no Aa. Opened from Q7 and from a
    Kur'an group's screen once its round is complete. From Q7 the stack is rebuilt so back lands on
    the group.

**Other screens with non-obvious rules**

-   Ana sayfa (B8): two layers; the greeting band is fixed and **the card and the paper scroll
    together**; no pull-to-refresh. The scroll view is paper and its content green (the tab bar's
    fade shows what is behind the scroll view). Nothing may scroll under the transparent bar: iOS 26 fades it, and
    `scrollEdgeEffects: { top: 'hidden' }` does not reach Home's scroll view. The day as tasks (`utils/homeTasks.ts`) — "Sıradaki" card, "Sonra"
    by deadline, "Bugün okunanlar" (from `myShareDoneAt`); B8b day done, B9b every share done,
    B9 no group. A hatim member with no holding and no skip is a pick task (`mustPickCuz`, server);
    it opens `GroupDetail`, whose gate routes to the pick (after Q7 when due), never `RoundStart` directly.
-   **A screen's `replace`/`goBack` act on the top of its stack, not on the calling screen.** A
    screen that may be covered (`RoundStart` under the cüz map) replaces itself only when focused.
    Cüz progress is pages read, stored on the device per round (`utils/cuzPagesRead.ts`). Nothing
    on Home marks a bab read. The error state (inside the sheet) shows only when there is no data
    and nothing is fetching — a failed background refetch keeps the last list. A refetch is timed
    to the next round boundary (`nextBoundaryAfter`). `weekStrip` takes "today" from the payload.
    Footer links open `AllBabs` and the group-less `Mushaf` reader.
-   Group screen: whole-group actions are the heading's corner actions only; members is a sheet.
    Yönet edits only name, intention and visibility.
-   Sign-in errors: one generic banner plus offline (`utils/signInErrors.ts`); no per-cause messages.
-   Invite preview (non-members): shows counts, never member names; a hatim's count is cüz taken
    (`30 − poolBabNumbers`), as on its gathering card. **A private group answers preview and join
    by id to members only** — anything reached with an invite code (`PickCuz` from the code sheet)
    previews and joins by the code (`inviteCode` param).
-   Onboarding (A1): five slides, each draws its own container; slide copy covers Cevşen and Kur'an.

**Tour (section O)** — `components/Tour`, opens once from Ana sayfa (`hasSeenTour`):

-   Always runs on its own fixtures (`tourDemoData`, separate `tourDemoQueryKeys`, with
    `initialData`). While it runs the app is inert (`TourBlocker`) and Android back is swallowed.
-   Targets measure with `measureInWindow`, withdraw on blur; bar-glyph targets are arithmetic
    (`useTourBarTarget`). Ending anywhere but Home pops the tab stack **with a `target`**.
-   Copy `tour1…tour16` is numbered in visit order — inserting a stop renumbers.

**Environment and releases (EAS)**

-   `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: local from `apps/web/.env`; builds from
    EAS environments. Check resolution with `eas env:exec <env> '<cmd>'`, not `env:list`.
-   **`eas update` must carry `--environment`** and **run from `apps/web`**:
    `eas update --branch preview --environment preview -m "…"` (same for production). Without it the
    bundle bakes in localhost and a test Clerk key.
-   A channel must be mapped to its branch (`eas channel:edit <name> --branch <name>`).
-   A fresh install runs its embedded bundle first; the update applies next launch.
    `CheckForUpdateOnLaunch` handles it — don't use `fallbackToCacheTimeout`, and don't call
    `checkForUpdateAsync` yourself.

## Content sources — never generate, transliterate or approximate religious text

-   **Cevşen** (`cevsen.data.json`): 100 babs, 999 invocations, the du'a after bab 100, from the
    Risale-i Nur Kütüphanesi app's `cevsen.txt`. Keep its Ottoman/Turkish orthography; the long î is
    written `U+0656` (converted from the file's `U+06EA`) — don't "fix" it back. Nesih is the default
    face; `ornamentFaceFor` stays for KFGQPC.
-   **Kur'an text**: Quran Foundation, via `scripts/fetch-quran-text.ts` (moves a misplaced end mark,
    never words). Sura metadata from the same API.

## Notifications

**Local daily reminder** (`useReminderNotificationSync`, mounted app-wide in
`NotificationOrchestrator`): one repeating trigger, reconciled on mount, on settings/count change and
on foreground, comparing signatures (`triggerSig`, `contentSig`) rather than rescheduling.

-   Serialise runs (rerun flag), never drop them. Act only when settings and groups are both known,
    or when signed out (= cancel). Stand down while the tour runs.
-   The reconciler never requests permission — only `HomeScreen` (once per session, if `canAskAgain`)
    and `RemindersScreen` (when the switch turns on).
-   Declare the Android channel right before scheduling. `setNotificationHandler` at module scope.
-   A time already passed today fires tomorrow (`isNextReminderTomorrow` says so on screen).
-   The body counts all running groups (`reminderTotals`). `reminderEnabled` is the only switch.

**Server push** (`push.service.ts` → `sendPushToUser`, via `expo-server-sdk`):

-   Six events; only "your pool claim was released" is unconditional, the rest have P4 switches
    (`groupReadsEnabled` off by default, `roundCompleteEnabled` on by default).
-   Share-finished and round-complete fire **once per round**, claimed on the read's own transaction
    (`ShareReadNotice`, `RoundCompleteNotice`). Covering a closed round sends nothing (tested).
-   Send **after the commit**, `await` it, and it never throws. Prune only `DeviceNotRegistered`.
    A push always leaves a trace (inbox row / `PoolClaimRelease`). Copy is `utils/pushCopy.ts`.
-   `usePushTokenRegistration` registers on sign-in and withdraws on sign-out.
-   Delivery needs an APNs key (`eas credentials -p ios`) and, on Android, both
    `google-services.json` (committed) and the FCM V1 service-account key in EAS. The simulator can
    get a token but never receives a real push — test on a device build. A ticket is not a delivery;
    check receipts.

## Marketing site (`apps/marketing`)

-   Astro, static, **zero JavaScript**. Three languages at three URLs: `/` English, `/tr/`, `/nl/`
    (`i18n/routing.ts`); every page declares all `hreflang` alternates plus `x-default`.
-   Copy in `i18n/copy.ts` (typed across languages). **`i18n/legal.ts` must match the app's real
    behaviour** — a new setting, data flow or third party changes it in the same commit.
-   Entrance animations only inside `prefers-reduced-motion: no-preference` (and `@supports` for
    scroll-driven ones). `.section` uses padding longhand.
-   Store buttons are not links until the URLs in `src/config.ts` are set. Share cards are generated
    by `pnpm --filter @cuzhane/marketing og` and committed. Fonts self-hosted via `@fontsource`.
