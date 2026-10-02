# Live voice in "Birlikte oku" — design

The reader of a live session can turn their voice on; the people following hear them live, for
reading together at a distance. Agreed on 2026-10-01, after two independent reviews (a fresh agent
and Codex) of how the audio should travel; the user chose Cloudflare Realtime over the reviews'
shared pick, LiveKit Cloud, for cost.

## Scope

-   **One voice: the reader's.** Followers only listen. No passing the microphone, no group call.
-   **Live only.** Nothing is recorded or stored — not by us, not by Cloudflare (no recording
    features are used).
-   **Off unless the reader turns it on**, per session. Both kinds: the free Cevşen and the free
    Mushaf.
-   **Tap to listen.** A follower sees "voice is on" and a Listen button; nothing plays until they
    tap. Their choice holds for the rest of that session.
-   **Like a podcast.** A follower keeps hearing with the screen locked or in another app, with the
    phone's own play/stop controls on the lock screen. Starting again always joins the reader where
    they are now — never a replay.
-   **Up to the existing session size** (load-tested at 500 followers). Typical: a handful to a few
    dozen.
-   **Delay low enough to match the band** ("Göster"): target under 0.5 s mouth to ear.

## How the voice travels

**Cloudflare Realtime (SFU) copies the reader's stream to each listener. Our API is the gatekeeper
and never carries audio.** The app never holds Cloudflare's secret.

```
Reader ──mic──▶ Cloudflare Realtime ──▶ each listener
   │                 ▲   ▲
   └─▶ our API ──────┘   │   (our API calls Cloudflare with the app token)
          └── live socket: voice on / off / paused, positions, marks (as today)
```

1. **Voice on**: the reader's app gets the microphone, makes a WebRTC offer and posts it to our
   API. The API checks the caller leads the session, creates a Cloudflare session and pushes the
   track with that offer, returns Cloudflare's answer, and announces `voice: on` on the socket.
2. **Listen**: a follower's app asks our API; the API checks they are connected to that session's
   room, creates a Cloudflare session pulling the reader's track, returns Cloudflare's offer; the
   app answers and the API completes the renegotiation.
3. **Voice off / session over**: the API closes the reader's track at Cloudflare and announces
   `voice: off`; listeners close their connections.
4. **Strict networks**: every voice response carries short-lived Cloudflare TURN credentials.

Rejected: relaying audio frames over the live socket (TCP stalls on loss; ~25,000 sends/s at 500
listeners through the API process; all capture/playout would be our own native code), HLS or
Icecast (2–10 s behind the band), self-hosting an SFU on the 2 GB droplet beside production's
database (UDP ports, TURN, certificates, unproven at 500), LiveKit Cloud (least code, but
$50/month above 100 concurrent listeners — the user chose Cloudflare's near-zero cost and the
extra code).

## Server (`apps/server`)

-   **No database change.** Voice state lives in the room in memory (`liveHub.service.ts`): `off |
    on | paused` and the reader's Cloudflare session and track name.
-   **Routes** under `/api/live/:sessionId/voice`, thin as usual, Zod in `src/schemas/live.schema.ts`,
    logic in a new `liveVoice.service.ts`, and a per-user rate limit each (they call a third party):

    | Route                      | Who                        | Does                                                         |
    | -------------------------- | -------------------------- | ------------------------------------------------------------ |
    | `POST …/voice`             | the leader                 | push the reader's track; answer; announce `on`               |
    | `DELETE …/voice`           | the leader                 | close the track; announce `off`                              |
    | `POST …/voice/listen`      | a follower in the room     | pull the reader's track; return Cloudflare's offer           |
    | `PUT …/voice/listen`       | that follower              | send the app's answer (renegotiate)                          |

-   **Who may listen**: only a user connected to that session's room on the socket. A session id
    alone is not enough.
-   **Socket**: the snapshot carries `voice`; a `voice` message announces each change, so a late
    joiner sees the state at once. **Paused** when the reader's app reports it cannot send (no
    network, a phone call) and while the reader's socket is away. **Off** — and the track closed
    at Cloudflare — when the reader turns it off, leaves or ends the session, or the session ends
    by the reader's absence or the 10-minute idle end.
-   **Secrets**: `CLOUDFLARE_REALTIME_APP_ID`, `CLOUDFLARE_REALTIME_APP_TOKEN`,
    `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_KEY_TOKEN` — in `compose.yml` and
    `compose.preview.yml`, values in the server's `.env` by hand. Unset: voice answers
    "unavailable", live reading carries on.
-   **Tests** (Cloudflare's HTTP API faked): happy paths; refusals — not the leader, not in the
    room, session ended, voice already off; rate limits; cleanup on end, absence and idle.

## App (`apps/web`)

-   **Native** (needs a new EAS build; an OTA update cannot add it):
    -   `react-native-webrtc` with its Expo config plugin — the connection itself.
    -   Our own Expo module, `modules/live-voice`: on iOS the audio session (listening: playback,
        speaker, keeps playing when locked; reading: microphone and speaker) and the lock-screen
        entry with play/stop (`MPNowPlayingInfoCenter`, `MPRemoteCommandCenter`); on Android a
        foreground service with its notification and play/stop (`mediaPlayback` for listeners,
        `microphone` for the reader).
    -   Microphone permission with plain reasons in TR / EN / NL, asked only when the reader first
        turns voice on; iOS background mode `audio`.
    -   Loaded in a `try`, like `@expo/ui`: a build without the module shows no voice controls and
        never crashes. Old builds ignore the new socket message.
-   **One app-wide voice store**, `lib/live/liveVoice.ts`, beside `liveSession.ts` and built the
    same way (subscribe / snapshot, hooks in `lib/hooks/useLiveVoice.ts`): states off, connecting,
    listening, paused, stopped-by-me, unavailable. Follows the socket's `voice` messages,
    reconnects with backoff, closes when the session ends, is left, or the account signs out.
    Tested like `liveSession.test.ts`.
-   **Screens** to the designer's design, 1:1:
    -   reader — a Voice switch in the live sheet; "voice on" / "voice paused" in the live bar;
        microphone refused: the switch stays off, with how to allow it in Settings;
    -   follower — "voice on" with Listen / Stop in the live bar, the return strip and the iOS
        tab-bar accessory; "voice paused" when the reader's voice drops.
    -   Strings in TR / EN / NL, plain words.
-   **Privacy** (`apps/marketing/src/i18n/legal.ts`, same commit): when the reader turns voice on,
    their voice passes live through Cloudflare to the people in the session; it is not recorded or
    stored; the microphone is used only while voice is on.

## Contract (server ↔ app)

**Voice state**: `type LiveVoice = 'off' | 'on' | 'paused'` — in `live.schema.ts` and mirrored in
the app's `domain.ts`.

**Socket**

-   `snapshot` gains `voice: LiveVoice`.
-   New server frame `{ t: 'voice'; voice: LiveVoice }`, broadcast to the whole room on every
    change (the reader too).
-   New client frame, reader only: `{ t: 'voice'; seq: number; state: 'on' | 'paused' }` — the
    reader's app saying it cannot send (no network, a call took the microphone) or can again.
    Ignored while voice is `off`; a follower sending it gets `error: not-leader`.
-   The reader's socket going away sets `paused`; the reader coming back restores `on` only if the
    reader's app says so (`state: 'on'`) — the app re-publishes after a reconnect.

**Routes** (behind `requireAuthApi`; `:sessionId` as `LiveSessionIdParamsSchema`; errors are
`HttpError`). `iceServers` is Cloudflare's `generate-ice-servers` answer, passed through.

| Route | Body | 200 | Refusals |
| --- | --- | --- | --- |
| `POST /api/live/:sessionId/voice` | `{ sdp: string ≤ 16 000, mid: string ≤ 16 }` | `{ answer: { type: 'answer', sdp }, iceServers }` | 404 no such live session; 403 caller not its reader connected on the socket; 503 voice not configured |
| `DELETE /api/live/:sessionId/voice` | — | `{ success: true }` | 404; 403 not the reader |
| `POST /api/live/:sessionId/voice/listen` | — | `{ listenerSessionId, offer: { type: 'offer', sdp }, iceServers }` | 404; 403 not connected to the room as a follower; 409 voice is `off`; 503 |
| `PUT /api/live/:sessionId/voice/listen` | `{ listenerSessionId: string ≤ 128, sdp: string ≤ 16 000 }` | `{ success: true }` | 404; 403 that listener session is not this user's in this room |

-   A second `POST …/voice` (the reader reconnecting) replaces the first: the old track is closed
    at Cloudflare, listeners are told `voice: on` again and re-listen.
-   The room remembers each listener's Cloudflare session against its user, so `PUT` can check it.
-   Cloudflare calls: `POST /apps/{app}/sessions/new`; `POST …/sessions/{id}/tracks/new` (reader:
    `{ sessionDescription: offer, tracks: [{ location: 'local', mid, trackName: 'voice' }] }`;
    listener: `{ tracks: [{ location: 'remote', sessionId: readerSession, trackName: 'voice' }] }`,
    which answers with an offer); `PUT …/sessions/{id}/renegotiate` (the listener's answer);
    `PUT …/sessions/{id}/tracks/close` (`{ tracks: [{ mid }], force: true }`) to stop the
    reader's track. TURN: `POST /v1/turn/keys/{key}/credentials/generate-ice-servers`
    (`{ ttl }`). Base `https://rtc.live.cloudflare.com/v1`, bearer tokens.

**Added with the design (2026-10-01)** — the reader sees who listens:

-   `LivePerson` gains `isListening: boolean` — true from a successful `PUT …/voice/listen` until
    that person stops, leaves the room on every phone, or voice goes off / is re-published.
    Changes go out through the existing (throttled) `people` frame.
-   `DELETE /api/live/:sessionId/voice/listen`, body `{ listenerSessionId }` → `{ success: true }`;
    403 when that listener session is not this user's; an unknown or already-forgotten one is a
    success. Shares `liveListenRateLimit`.

**App**: `api/live.api.ts` gains `startLiveVoice`, `stopLiveVoice`, `listenLiveVoice`,
`answerLiveVoice`; `LiveSessionState` gains `voice: LiveVoice` (from the snapshot and `voice`
frames); the connection gains `sendVoice(state)`.

## Build order

0.  **Spike** — throwaway, on real phones, nothing in the app. Proves: `react-native-webrtc`
    builds on Expo SDK 57 (RN 0.86) on iOS and Android; a reader's voice reaches a listener through
    Cloudflare, delay measured on Wi-Fi and mobile data (target < 0.5 s); a listener keeps hearing
    10+ minutes locked; the reader keeps sending in the background and locked; our lock-screen
    controls work beside WebRTC; reconnect after Wi-Fi → mobile data. **If the build or locked
    listening fails, stop and decide again.**
1.  **Server** — routes, socket voice state, cleanup, secrets, rate limits, tests.
2.  **Native module and voice store** — `modules/live-voice`, WebRTC wiring, the store and tests,
    permission strings.
3.  **Screens** — from the designer's design; strings; privacy text.
4.  **Checks** — server and web tests, type check, lint; an iPhone and an Android phone together
    (on/off, listen/stop, late joiner, locked and backgrounded on both sides, network drop, a call
    interrupting the reader, session end, idle end, sign-out); the 500-follower load test extended
    with voice messages; a Codex review of the whole change.

Release: a new EAS build, and the four Cloudflare variables in the server's `.env`, preview first.
