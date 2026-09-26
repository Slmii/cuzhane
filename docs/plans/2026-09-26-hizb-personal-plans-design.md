# Hizb personal plans within shared groups

Status: approved and implemented locally on 2026-09-26. Existing groups retain their legacy model; newly created Hizb groups use personal plans. Production deployment is outside this change.

## Confirmed requirements

- People create separate groups, with unlimited members.
- A creator can require the same 7-, 15-, or 33-day plan for everybody, or allow each member to choose among those plans in a mixed group.
- The plan determines each person's daily reading amount; membership count does not change that amount.
- Everybody advances each group-local calendar day. Missed assignments remain available for catch-up and do not postpone future assignments.
- Personal completion requires actually finishing every assigned portion in a traversal, including catch-up. Elapsed days alone do not count as completion.
- New participants join at the end of the sequence.
- An optional inactivity rule removes a participant after a configured number of days without reading; 10 days is the user's example.
- A removed participant sees the reason on returning and can explicitly rejoin at the end of the sequence.
- The user authorizes proposing the seven-day division from the existing text.
- Sekine continues to require 19 repetitions from its individual reader whenever assigned.

## Approved seven-day division

This is an app-designed division, not an assertion about the missing family's seven-day table. It uses existing 33-day boundaries, preserves reading order, and covers the entire current digital source once. That does not resolve the separately documented missing Amenerrasulu passage in the digital source.

| Day | Reading | Existing 33-day portions | Inclusive source start |
| --- | --- | --- | --- |
| 1 | Opening istighfar and Quran readings; Cevsen babs 1–20 | 1–4 | section 0 |
| 2 | Cevsen babs 21–81 | 5–7 | section 7, block 18 |
| 3 | Cevsen babs 82–100 and its closing prayer; complete Evrad-i Kudsiyye | 8–13 | section 7, block 79 |
| 4 | Complete Delail-in Nur; Sekine with 19 repetitions | 14–19 | section 9 |
| 5 | Veysel Karani and the Ism-i Azam prayers; Munacat-ul Quran from Fatiha up to, excluding, Lokman | 20–22 | section 11 |
| 6 | Munacat-ul Quran from Lokman to its end; complete Tahmidiye | 23–26 | section 14, block 26 |
| 7 | Complete Hulasat-ul Hulasa and the final Tazarru ve Niyaz prayers | 27–33 | section 16 |

Each end is the next day's start, exclusive; the last ends at the source's end. Coordinates are zero-based. Rough whitespace word counts, counting the Sekine passage from Bismillah 19 times, are 3896 / 3864 / 4480 / 4299 / 2867 / 4272 / 3240. These are balance checks, not reading-time estimates; they include source headings and editorial lines. Existing Cevsen boundaries still carry the interpretation documented in the earlier source review.

## Fifteen-day division: approved boundary

Use the independent supplied table, not equal-sized bundles of the 33-day portions. Inspection of `whatsappfotos/WhatsApp Image 2026-09-26 at 01.27.34.jpeg` confirms the table's abbreviated Hulasat boundary. The digital text has two openings matching that abbreviation:

- section 16, block 13: continues with `bi-lisani'l-hakikati'l-insaniyye`;
- section 16, block 16: continues with `dhu'l-kamalati...`; this is also the existing 33-day portion 29 start.

The user approved the later start (section 16, block 16). The supplied fifteen-day table alone does not disambiguate the occurrence. The Munacat Saffat boundary is section 14, block 30; Cevsen bab 51 starts at section 7, block 48. Content tests verify these anchors and complete source coverage.

## Sequence rules

- Maintain append-only join order for the group and a separate append-only rotation sequence for each plan. In a fixed-plan group these coincide. In mixed groups, compare positions within the same plan because portion numbers from different divisions do not describe the same text.
- Persist monotonic group-order and per-plan counters on the group so account deletion cannot reuse an earlier position. Assign the next sequence number transactionally. Retried joins are idempotent; simultaneous joins receive distinct sequence numbers.
- With a group-local day index D, plan length P and zero-based sequence S, today's portion index is `(S + D) % P`. Save each enrollment's first eligible date; joining never creates pre-join arrears.
- Leaving or removal does not renumber others. Rejoining creates a new enrollment at the tail. Never reuse an old enrollment's assignment identity or repetition counter.
- Numbering wraps for the reading position, not for the participant's join order. More than P members can read the same portion, each with their own completion record.
- A personal traversal is P assignments from that enrollment's starting portion, wrapping at the book's end. A new traversal has independent assignment identities even when older catch-up is still pending.
- With P occupied distinct positions, completing all assigned portions covers the book daily. Membership count alone cannot prove coverage: departures can leave gaps, and additional members may duplicate occupied positions.

## Inactivity rules

- Creator setting: disabled, or 1–365 consecutive group-local days without a completed assigned reading; the creation form defaults to enabled with 10 days. Changing the policy starts a fresh grace period after applying any removal already due under the old policy.
- Count a completed personal daily assignment, including completion of a catch-up assignment. App opens, scrolling, other people's readings and an incomplete Sekine counter do not reset inactivity.
- Evaluate complete calendar days. The join date is the first eligible reading date, and nobody is removed for time before joining.
- A removal closes active enrollment and future assignments at its effective cutoff. Keep all prior reading history and partial repetition counters. Delayed evaluation must use that cutoff rather than creating assignments indefinitely until someone opens the app.
- Preserve a durable removal reason and effective date. Show: "You were removed from the reading schedule because you did not complete a reading for 10 days. Would you like to join again?" Substitute the configured duration.
- Rejoining requires an explicit action and creates a fresh tail position. Existing catch-up remains historical and accessible; it does not silently become the new enrollment's work.
- Separate group administration from reading enrollment so inactivity can remove an owner's reading commitment without destroying or orphaning their group.

## Personal and shared completion

- A dated personal assignment is owned by one enrollment and plan version. Multiple people reading the same passage must not overwrite or complete one another's assignments.
- Fixed-plan daily group coverage uses actual distinct completed portions for that date, not completed-person counts.
- Mixed-plan daily group coverage uses canonical text spans formed by the union of all released plan boundaries. A completed assignment covers its own spans; overlapping reads do not conceal missing spans.
- Daily coverage belongs to the assignment's original date even if completed late. Keep completion timestamps for activity statistics separately.
- Sekine contributes coverage only after one reader completes all 19 required repetitions for that occurrence. Counts cannot be pooled between members or reused on another date.
- A mixed group can have full daily coverage, but its mix of member counts and paces does not guarantee it. Show actual progress rather than promising a daily group completion.

## Implementation direction

The existing seat model stores one completion per group/round/portion and reuses free seats. Unlimited personal rotations need enrollment and assignment records that can represent several readers completing the same text on the same date independently. The implementation adds explicit plan versions, enrollment history and dated personal assignments; it does not reinterpret existing `BabRead` history as personal assignments.

Keep existing groups' history intact. Any transition of an existing Hizb group needs a defined effective date; old records retain their original meaning. Group creation, invitation previews, personal reading, group overview, catch-up, notifications and privacy shaping all need to understand the new plan mode before exposing it to users. Existing Cevsen behavior retains its contracts.

Verify content coverage and exact boundaries; whole P-day traversals; joins on later dates; unlimited and concurrent joins; removals and rejoining; midnight/DST behavior; duplicate requests; independent repetitions; catch-up across traversals; mixed-plan overlaps/gaps; authorization/privacy; and preservation of existing group history.
