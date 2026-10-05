# Live reading sessions ("Birlikte oku") — design

One person reads; the people following see the same bab or Mushaf page and follow the reader's
scroll, live. Agreed on 2026-09-30, after two independent designs (a fresh agent and Codex) were
compared.

## Scope

-   **Free reading only**: the free Cevşen reader and the free Mushaf. No group readers, no Hizb.
-   **Anyone signed in can start one.** Others join with a share link or code.
-   **Nothing is marked.** Free reading records no shares, so following earns no credit and
    changes nobody's progress.
-   **Leader drops out** (app closed, connection lost): followers see "Waiting for the reader"; the
    session ends after 60 seconds. No hand-over.
-   **Leader stops reading** (still connected, but no scroll or turn for 10 minutes): the session
    ends for everyone (`idle`). Every place the reader sends starts the 10 minutes again.
-   **The session is the app's, not a screen's** (`lib/live/liveSession`, 2026-10-01). Leaving the
    reader leaves it running; the free reader of its kind attaches while focused and starts at the
    reading's place (the reader's own, or the reader's for a follower, who comes back following).
    A reader opened at a place of its own (search) lets a follower arrive detached. The other
    kind's free reader opens on its own. Followers see nothing while the reader browses elsewhere.
    Joining or starting another session while leading one asks first; a code that finds nothing
    never touches the running session. Signing out or switching accounts drops it. A strip at the
    bottom of every other screen shows it is still on and leads back ("Okumaya dönüş şeridi").
-   **Everyone in the session sees the names** of the reader and of the other followers. There is
    no group, so `hideMemberNames` does not apply; everyone joined through a link someone shared.
-   **Kur'an edition is forced, font size is not.** For the session a follower switches to the
    leader's edition (Hüsrev or typeset), without saving it, so page N is the same verses for
    everyone and a Hüsrev fraction lands on the same line. Font size stays the follower's own:
    many readers set a large size on purpose.
-   **No push.** There is no group to notify; the link is the way in.

## Design

**Transport: WebSocket in the existing API process** (`ws`, `noServer`, path `/api/live`).

-   One API process per environment, so fan-out is an in-memory map; no Redis or broker.
-   Caddy's server-wide `write 30s` would cut an SSE stream; an upgraded WebSocket is a hijacked
    connection and is not subject to it (to be proven in Phase 0). React Native has a native
    WebSocket, so the app needs no dependency.
-   Hosted services (Ably, Pusher, Supabase Realtime) were rejected: a new processor in
    `legal.ts`, a new secret and cost, and no benefit at one process.
-   **Auth**: nothing in the URL (Caddy logs URLs). The first frame is `{t:'auth', token, v}` within
    5 s, verified with Clerk's `verifyToken`; the client re-sends `{t:'reauth'}` every ~4 min.
    The upgrade bypasses Express, so the socket layer carries its own Zod validation, frame size
    cap (`maxPayload` 2 KB), per-user connection cap and per-socket rate limits.
-   `index.ts` shutdown closes sockets with 1012 before `server.close()`, so clients reconnect at
    once after a deploy.

**State**

-   Postgres: a small `LiveSession` row (id, leader, join code, started, heartbeat), made with
    `db:migrate`. It gives the code a home that survives a deploy and makes starts race-safe. The
    row is deleted when the session ends; no history.
-   Memory only: the latest position, sequence number and connected sockets.
-   Stale rows (no heartbeat for 3 min) are treated as ended and removed on read, the
    `ensureCurrentRound` way.

**REST**: `POST /api/live` (start → code + link, rate-limited), `GET /api/live/:code` (preview:
reader's name, what they read, follower count), `DELETE /api/live/:id` (end).

**Position protocol** — a place in the text, never pixels:

-   Cevşen: `{ bab, fraction }`; the invocation-level anchor (from `onTextLayout`) is Phase 2.
-   Kur'an: `{ edition, page, fraction }` plus the top verse key; with the edition forced, page and
    (on Hüsrev) fraction are exact.
-   The leader sends on every unit/page change at once, during a scroll at most every 250 ms plus a
    final frame, nothing when unchanged. `(epoch, seq)` orders frames; older ones are dropped. A
    late joiner gets the current position immediately.

**Screens**

-   Leader: a "Birlikte oku" action in the free readers starts a session and opens a share sheet
    (link + code); a "Canlı · 3 kişi" chip and an end action while live. Bar actions via
    `AppNavigator` `options`.
-   Follower: a read-only `LiveFollow` screen in `sharedTabScreens()` reusing the free readers'
    bodies (`ReaderBody`, `MushafPage`, `MushafImagePage`). It never writes a bookmark or pages
    read. Position arrives through refs, never props, so the memoised Arabic is not re-typeset per
    tick. A hand scroll detaches; a "Takip et" pill re-attaches. Keeps the screen awake.
-   Link: `cuzhane://live/CODE` and a static page on the marketing site (`/live/CODE`) that opens
    the app or points to the stores. An old build opening the link lands on Home.

## Phases

0.  **Spike — done 2026-09-30**, locally: `ws` behind `caddy:2.11-alpine` with the production
    Caddyfile's global timeouts, `encode zstd gzip`, `request_body` and `header` blocks.
    -   A socket sending every 20 s and a socket silent for 150 s both stayed open for 200 s: the
        `write 30s` and `idle 2m` deadlines do not apply to an upgraded connection, and `encode`
        leaves it alone.
    -   A Caddy config reload closed open sockets at once (1001). With `stream_close_delay 5m` on
        the API sites' `reverse_proxy`, a socket survived a reload and kept working. That line goes
        into `deploy/Caddyfile` with Phase 1 — it ships from `main`, so it reaches production with
        the release.
    -   An API container restart (every deploy) still drops sockets; the client reconnects with
        backoff and the leader re-sends its position.
1.  **MVP**: table, routes, socket hub with limits, server tests (start/join by code, bad or ended
    code, leader timeout, stale and over-rate frames dropped, late-join snapshot, shutdown); the
    app's start/share/join flow, the follow screen, bab and page sync with fraction scroll.
2.  **Precision**: Cevşen invocation anchors, Mushaf row anchors, detach pill polish.

The design keeps a group-reader extension possible later (sessions scoped to a group, with the
membership, privacy and credit rules the first designs worked out), but builds none of it now.
