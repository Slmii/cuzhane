# Individual Hizb reading

The user requests an individual group for personal tracking, including following a group outside the app and choosing a starting portion. Reuse the existing personal-assignment model, with a separate immutable individual flag. A normal private group could accept invite holders, so individual reading also needs enforced owner-only access and disabled admissions. A separate unrelated reader would duplicate progress and catch-up; reuse is preferred.

## Design

Creation offers group reading or individual reading for Hizb. Individual reading requires a fixed 7-, 15-, or 33-day plan and a valid starting portion from that plan, with its existing reading description shown. It starts today, rotates through the end and wraps to portion 1. No pre-start arrears or completed readings are invented. Existing assignments, bookmarks, Sekine counts, personal traversals and reminders work normally. Outside-group reading is not inferred.

Individual entries are private, cannot accept members, and have no inactivity removal. Hide sharing, membership, shared-coverage and inactivity controls; retain renaming and deletion. Group mode retains all existing behavior. Daily advancement matches the outside-group scenario and is the communicated default; the optional pacing question received no answer during implementation. The daily boundary uses the creator’s device timezone. Individual entries cannot leave through the membership endpoint; deletion remains available in settings. Shelf progress represents today’s personal assignment, not outside-group coverage.

## Implementation

1. Add failing service tests: selected starts for each plan, wrapping, no pre-start arrears, private/closed creation, denied code previews/joins and policy changes, invalid starts rejected. Run the tests to confirm missing behavior.
2. Add an additive `Group.hizbIndividual` flag and `hizbStartPortion` field with defaults preserving existing groups. Validate creation and updates in server schemas/services. Apply start offset consistently in assignment generation and summaries.
3. Add individual creation controls and starting portion descriptions; adjust personal overview and administrative controls. Add TR/EN/NL copy and serialize the new fields.
4. Run focused tests, then all server/client tests, type checks, lint, and a web export. Apply migrations only to guarded local databases. Preserve unrelated ongoing onboarding edits.

## Validation

- New regression tests cover all three start positions and wrapping, privacy and invitations, invalid combinations, daily shelf progress, and preventing an orphaned individual reading through the leave endpoint.
- Full client suite: 475 passed. Full server suite: 308 passed, including the final leave regression (783 total).
- Workspace type checks, lint and Expo web export passed.
- Additive migration applied to the guarded test database and verified local development database.
- No deployment or authenticated device walkthrough performed.
