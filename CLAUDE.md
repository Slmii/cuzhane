# CLAUDE.md

Guidance for Claude Code in this repository: conventions, rules and the traps that have bitten
before. How features behave lives in the code, its comments and `docs/plans/` — not here.
**Never run commands against a deployed server** — anything that needs checking or changing there
is handed to the person you are working with. Operator-specific notes, if any, live in a local,
uncommitted `CLAUDE.local.md`.

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
    A test that depends on the time of day freezes `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`),
    or it flakes across a group's midnight.
-   Prisma: `pnpm --filter @cuzhane/server db:migrate|db:generate|db:studio|db:seed`. **Never hand-write
    a migration**: `db:migrate --name …`, then `db:generate`. A data backfill goes into a migration made
    with `--create-only`, then applied. **Never run `prisma format`** — the schema files are 4-space
    indented and it rewrites them to 2; check with `prisma validate`. `db:seed` rebuilds the dev data.
-   Server build: `tsc` + `tsc-alias --resolve-full-paths` (path aliases are rewritten at build time).
-   The Hüsrev page images in `apps/server/mushaf/` are gitignored and not in the repository — nothing
    here regenerates them. Without them only the Hüsrev reader is empty.
-   Format: Prettier — tabs, width 120, single quotes, no trailing commas. `.astro` and
    `design_handoff_cuzhane/` are prettier-ignored. Format only the files you touched.

## Branches, CI and deploy

-   **`development` is the default branch** and deploys **preview**; `main` deploys **production**.
    Feature PRs target `development`; releases go `development` → `main`.
-   `deploy-server.yml` runs on pushes to either branch that touch `apps/server/**`, `deploy/**` or
    the root package files: builds the image to GHCR, copies the deploy files onto the server, runs
    `up -d --wait`, smoke-tests. `deploy-marketing.yml` (main only) ships the Astro build.
-   `server-tests.yml` runs the server's type check, lint and tests (against a Postgres service) on
    every PR into `development`. Its job `server-tests` is a **required check** in the branch rules,
    so it has no path filter — a required check that never starts blocks the PR. Renaming the job
    means re-selecting it in the rule.
-   Secrets are never in the repo. Edit deploy files here, never on the server — CI overwrites them.
-   **Two compose files.** `deploy/compose.yml`, `Caddyfile` and `backup.sh` always ship from `main`;
    `deploy/compose.preview.yml` (only `api-preview` — the workflow refuses anything else) ships from
    the branch deploying. A new env var goes in the file for the environment that needs it —
    preview's on `development`, production's on `main` — and its value in the server's `.env` by hand.
    Compose defaults them to empty (`:-`), so a missing passthrough is silent.
-   A branch whose `.gitignore` predates the Hüsrev images shows them as untracked — never discard them.
-   **Claude review workflow** (`claude-code-review.yml`): the action skips unless the PR's copy of the
    workflow file is byte-identical to the default branch's. Change it on `development` first, then
    bring the identical file onto the feature branch. It also skips a PR it already reviewed. A re-run
    replays the original commit's workflow file.

## Domain rules — read before touching group logic

Three kinds: the **Cevşen** (`CEVSEN`, 100 babs), the **Kur'an** (`HATIM`, 30 cüz) and the
**Hizbü'l-Hakaik** (`HIZB`, 33 portions). The designs and decisions behind each are in
`docs/plans/`; these are the rules that keep them correct.

-   `unitCountFor(group)` answers "how many" — never write a literal 100. Every `kind` branch handles
    all three kinds.
-   **Mirrored files — change both**: `utils/babs.ts`, `utils/groupKinds.ts`, `utils/hizbPlans.ts`
    (server ↔ web), `services/groupSerializers.ts` ↔ `apps/web/src/lib/types/domain.ts` (field for
    field), and the Hizb works table (`apps/server/src/utils/hizbWorks.ts` ↔ `HIZB_WORKS` + the
    `hizbWork*` strings). The workspaces share no package.
-   **A Cevşen share is derived, never stored** (seat + round). `GroupBab.assignedUserId` means only a
    pool claim for this round, never seat ownership.
-   **A hatim's holdings are stored** (`CuzHolding`). Anything asking "who holds / owes cüz N" reads
    `CuzHolding` (`holdingsFor`, `resolveUnitPlan`) — seat maths means nothing for a hatim.
-   A Hizb group with a personal plan (`hizbPlan != null`) has no `GroupBab` rows; its reading lives in
    `hizbReading.service.ts`. Never compact or reuse its sequence/ordinal counters.
-   **Repetition gates** (Sekine, istighfar, Delâil) are each reader's own: counts are set absolutely,
    never incremented, and `assertRepetitionsMet` gates every path that marks a portion read.
-   **Old builds never see a kind they cannot draw.** Clients send `X-Cuzhane-Kinds` (`CLIENT_KINDS`);
    a request without it is taken to know CEVSEN and HATIM. A new kind goes into `CLIENT_KINDS` once
    the build can draw it.
-   `spots`, `splitMode`, `cycle`, `kind` are immutable after creation.

**Rounds**

-   Starting a round is a conditional `updateMany` on `status: 'GATHERING'`.
-   A round boundary is a **local midnight in the group's own `timezone`**. Zone maths is server-only,
    in `utils/rounds.ts` (`civilDayNumber`/`startOfCivilDay`). Never bucket with
    `Date.UTC(...getUTCDate())`. Personal stats use the **viewer's** zone.
-   **The rollover is lazy**: `ensureCurrentRound(For)` sits in front of every read/write path. A new
    read path must call it too.
-   **`GroupBab` is the current round; `BabRead` is the record** (append-only). Anything historical
    reads `BabRead`. Every read/unread path writes through `recordRead`.

**Invariants**

-   Claims and pool takes: conditional `updateMany` on `assignedUserId: null`, check `count === 0`.
-   **`completedAt` must agree with the board.** Every read-state write runs `syncCompletedAt` in the
    **same transaction**; it takes `SELECT … FOR UPDATE` on the group row first — without it,
    concurrent finishes miss the stamp. Route new read-state paths through it.
-   Privacy writes and inbox filing take the same group row lock, so a named notice cannot land after a
    scrub. Names shown to other members go through `isAnonymousTo` / `visibleUserId`.
-   **A display name is never an email address** — `resolveDisplayName`, `nameOf` and the client's
    `useViewerIdentity` fall back to "Member".
-   Group events are announced once per actor, per round, per subject (`GroupEventNotice`).
-   Unreferenced on purpose: `Cheer` and the `GroupWaitlistEntry` table. Dropping either needs a
    destructive migration.
-   Account deletion (`account.service.ts`) runs **before** Clerk's `user.delete()`.

## Server (`apps/server`)

-   `src/index.ts` → `createApp()` (`src/app.ts`). Pipeline: `helmet` → `cors` → `express.json(300kb)`
    → `clerkMiddleware()` → routers.
-   **Public: `/health` only.** Everything else is under `/api` behind `requireAuthApi` +
    `populateAuthLocals`, including the mushaf page images.
-   **Every server change ships with tests** in `test/` (Vitest, against `cuzhane_test`): a new route or
    service path gets tests for its happy path, its refusals and its privacy rules; a bug fix starts with
    a test that reproduces it. Run `pnpm --filter @cuzhane/server test` before calling it done.
-   Routes are thin (`src/routes/*.route.ts`); logic in `src/services/*`; Zod in `src/schemas/`
    via `validate.middleware.ts`. Id params are capped at 64 characters.
-   Per-user rate limits (`middleware/rateLimit.middleware.ts`): a new route that writes rows for other
    users or calls a third party gets one.
-   **Responses go through `services/groupSerializers.ts`** — never a raw Prisma row.
-   Pushes: send **after the commit**, `await` them, never throw; prune only `DeviceNotRegistered`.
    Copy is `utils/pushCopy.ts`. Once-per-round notices are claimed in the read's own transaction.
-   ESM + aliases (`@app`, `@config/*`, `@middleware/*`, `@routes/*`, `@schemas/*`, `@services/*`,
    `@db/*`, `@utils/*`, `@interfaces/*`). Strict: `noUncheckedIndexedAccess`,
    `exactOptionalPropertyTypes`.
-   Prisma schema is a **folder** (`prisma/schema/`); the client is generated to `src/generated/prisma`
    (gitignored — `db:generate` after cloning).
-   Env: `apps/server/.env` (see `.env.example`).

## Web (`apps/web`)

**Structure**

-   `index.ts` → `src/AppRoot.tsx`: `ClerkProvider` → `ThemeProvider` → `I18nProvider` →
    `QueryClientProvider` → `AppContainer`.
-   **`SafeAreaProvider` must stay at the app root** (`initialMetrics={initialWindowMetrics}`); anything
    rendered outside a navigator crashes the release build without it. An "abort() called" crash on
    `expo.controller.errorRecoveryQueue` is a swallowed JS error — read the real one from the device log.
-   **Every tab owns a stack; pushed screens go in `sharedTabScreens()`**, never the root stack. Tab
    screens type navigation with `TabStackParamList`.
-   Hide the bottom bar only via `TAB_BAR_HIDDEN_ROUTES`. A screen that keeps the bar must not inset its
    own bottom safe area.
-   `linking.ts`: every tab has `initialRouteName`; numeric params need `parse: { …: Number }`. A nested
    `navigate` into a tab that may not have mounted passes `initial: false`.
-   **Bar actions are registered in `AppNavigator` `options`, never from a screen's `setOptions`
    effect** (first frame would be empty). Size a `Host` in a header explicitly; never `matchContents`.
-   **A screen's `replace`/`goBack` act on the top of its stack, not on the calling screen.** A screen
    that may be covered acts only when focused.
-   Data: `api/wrapper.api.ts` attaches the Clerk token; feature APIs in `api/*.api.ts`, hooks in
    `lib/hooks/use*.ts`, keys in `queryKeys.ts`. Optimistic hooks keep the cancel/snapshot/rollback
    shape.
-   Path alias `@/*` → `src/*`.

**Conventions**

-   **No hardcoded colour** — `theme.colors.*` from `lib/theme/tokens.ts` (light + dark). Mind that some
    tokens coincide in dark mode (`surfaceMuted` = `surface`). `AppStatusBar` owns the status bar.
-   **No hardcoded user-facing string** — `lib/i18n/strings.ts`, **TR / EN / NL** (`en`/`nl` typed as
    `typeof tr`, so a missing key fails the build). TR is the default. Plain words for older readers.
-   Components: `components/<Name>/<Name>.component.tsx` + `<Name>.types.ts`, named exports,
    `StyleSheet.create` at the bottom. Text only through `components/ui/Typography`.
-   **Reuse the shared components; never hand-roll one they cover.** Buttons are `ui/Button`
    (`AppButton` — pick a `variant`, not a new `Pressable`), segmented choices `ui/SegmentedControl`,
    switches `ui/Switch`/`ToggleRow`, rows `ui/NavRow`, chips `ui/Chip`, inputs `ui/Input`/`Form`,
    progress `ui/ProgressBar`/`ProgressRing`, sheets `ui/BottomSheet`. Look in `components/ui/` first;
    if nothing fits, extend the shared component rather than adding a look-alike.
-   **Icons** only via `components/ui/Icon` (stroke only, ≥14px). **Never a typographic character as an
    icon**, not even inside a string. Beside a glass control use `ui/Icon/SymbolIcon`. An icon-only
    `AppButton` is the 44pt disc; it goes glass only for icons in `GLYPH_BY_ICON`, and needs
    `fullWidth={false}` in a row. `ICON_ONLY_GLYPH_SIZE` is mirrored in `Button.component.tsx` and
    `GlassButton.tsx`.
-   Native glass controls (`AppButton`, `SegmentedControl`) are created once and hidden/shown, never
    mounted on the spot — a fresh one draws its first frame unplaced.
-   Every SwiftUI `Host` carries `ignoreSafeArea='keyboard'` on the host itself.
-   Headings: `components/ScreenTitle` (pushed screens via `ScreenHeader`); never hand-roll one.
-   Forms: `components/ui/Form` + bound controls; schemas are factories taking `t` (`createXSchema(t)`,
    memoised on `t`).
-   **Sections are glass via `components/ui/CardSurface` only**. Don't override a card's `borderRadius`.
    Controls stay flat. No component checks Reduce Transparency.
-   A failed screen is `<ErrorState queries={[…]} />`. Pull-to-refresh via `usePullToRefresh(...)` +
    `ui/PullToRefresh` (the list needs `nestedScrollEnabled`).
-   Long lists (members, readers — a group can have hundreds) are a windowed `FlatList`, never a map.

**Sheets** — every modal is `components/ui/BottomSheet` → `AppBottomSheet` (the platform's own
sheet; no gorhom, no close button):

-   Content paints its own ground (`theme.colors.sheet`). Sheets size to content; for a fixed height use
    `heightRatio`, never `snapPoints`.
-   **Never let `enableDynamicSizing` change on a live sheet** (it remounts the content).
-   **Sheets cannot stack on iOS** — show a second page inside the same sheet, or switch via a route
    param and a delay; a destructive confirm is an `Alert` (`confirmDestructive`).
-   A sheet that must be a route registers under `sheetRouteOptions`.

**Motion and grids**

-   Motion is Reanimated. Prefer CSS keyframes/transitions over `entering`/`exiting`. Transition
    properties must sit on **one flat style object**, not a style array. Honour `useReducedMotion`.
-   **`Keyframe` is mutable** — build one per animated element (factories), never a shared constant.
-   Grids use `components/ui/CellGrid`. **Cells ease colour with a CSS transition, never
    `useAnimatedStyle`** (it made the board unscrollable). Keep `items`/`onPressCell` identity-stable.
-   A share is shown as one slice plus a count (`shareSlices` + `SliceChip`), never a list of ranges.

**Readers**

-   A verse mark in running Arabic is the character `۝` + number — **never an inline `View`** (RN
    misplaces views in RTL text). Every nested span re-declares the paragraph's `lineHeight`, or
    Android clips the paragraph.
-   Heavy Arabic text is memoised and given only what it draws — never props that change on every
    count or tap, or each tap re-typesets the page.
-   A pause mark sits on the text's own space; never swap it for a no-break space.
-   Lookups over the mushaf (`lib/content/mushafPlaces.ts`) are cached tables or binary searches, and
    long lists keep exact `getItemLayout` heights.

**Tour** (`components/Tour`) runs only on its own fixtures (`tourDemoData`, separate
`tourDemoQueryKeys` with `initialData`), keeps the app inert (`TourBlocker`), and its copy `tour1…N`
is numbered in visit order — inserting a stop renumbers.

**Environment and releases (EAS)**

-   `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: local from `apps/web/.env`; builds from
    EAS environments. Check resolution with `eas env:exec <env> '<cmd>'`, not `env:list`.
-   **`eas update` must carry `--environment`** and **run from `apps/web`**:
    `eas update --branch preview --environment preview -m "…"`. Without it the bundle bakes in
    localhost and a test Clerk key.
-   A channel must be mapped to its branch (`eas channel:edit <name> --branch <name>`).
-   Don't use `fallbackToCacheTimeout`, and don't call `checkForUpdateAsync` yourself
    (`CheckForUpdateOnLaunch` handles it).

## Notifications

-   The local reminder reconciler (`useReminderNotificationSync`) serialises runs, compares signatures
    rather than rescheduling, never requests permission itself, and declares the Android channel right
    before scheduling. `setNotificationHandler` at module scope.
-   Push delivery needs the APNs key and, on Android, `google-services.json` + the FCM V1 key in EAS.
    The simulator never receives a real push — test on a device. A ticket is not a delivery.

## Content sources — never generate, transliterate or approximate religious text

-   **Cevşen** (`cevsen.data.json`), **Kur'an** (Quran Foundation, via `scripts/fetch-quran-text.ts`)
    and **Hizbü'l-Hakaik** (`hizbulhakaik.data.json`, built from `scripts/hizbulhakaik.txt` by
    `node scripts/build-hizbulhakaik.mts` — edit the source and re-run, never hand-edit the JSON).
-   Keep the sources' Ottoman/Turkish orthography; the long î is written `U+0656` — don't "fix" it.
-   Where a passage is cut or repeated, it is cut on the source's own text (exact anchors), with a test
    that pins it. Tests compare against the source's lines, never Arabic typed into the test.

## Marketing site (`apps/marketing`)

-   Astro, static, **zero JavaScript**. Every page declares all `hreflang` alternates plus `x-default`.
-   Copy in `i18n/copy.ts` (typed across languages). **`i18n/legal.ts` must match the app's real
    behaviour** — a new setting, data flow or third party changes it in the same commit.
-   Entrance animations only inside `prefers-reduced-motion: no-preference`. Fonts self-hosted via
    `@fontsource`.
