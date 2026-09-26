# Opening istighfar repetitions

User supplied a highlighted page identifying the final istighfar sentence, followed by 11–33–100, and requests highlighting and guidance with a minimum of 11 recitations. Apply this only to the exact supplied sentence, not to unrelated Arabic verse or page numbers. The existing digital source already includes both the sentence and its repetition marker; preserve it unchanged.

Render the introductory text once, then the final sentence in a highlighted area with explicit guidance and selectable targets 11/33/100. Keep the explanation visible when this passage is read, including first use. Reuse the shared body so free, legacy and personal-plan readers all show it. Free/legacy body counters are session-local; personal plans persist a separate count and target on each dated assignment. No pooling with Sekine, other people or future assignments.

For personal plans, block a new completion until the selected target is reached (default 11). Existing completed history stays completed without manufacturing repetition counts; bookmark-only changes must still work. Undo requires satisfying the rule when completing again. Keep ordinary progress and Sekine behavior unchanged. Keep the count picker scrollable for a 100-repetition target.

Implementation: tests for exact passage extraction and unrelated markers, per-plan membership of the opening, independent persisted counters, defaults/targets, revision conflicts, reset on new assignment, pre-existing completion handling; additive migration; API/schema and reader changes; TR/EN/NL copy. Verify focused/full tests, types, lint and web export. No production deployment.

## Verification

- Full suite: 789 tests passed (478 client, 311 server).
- Workspace type checks and lint passed; Expo web export passed.
- Read-only review found a free/legacy page-navigation reset; local counters now live in the reader screen via `useIstighfarSession`, keyed by group/round for legacy reading, rather than the page body.
- Migration applied to the guarded test database and verified localhost development database.
- No production deployment or authenticated device walkthrough performed.
