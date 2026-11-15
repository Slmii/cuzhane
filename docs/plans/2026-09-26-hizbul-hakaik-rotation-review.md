# Hizbul Hakaik: attachment review and proposed daily rotation

Date: 2026-09-26. Status: researched proposal; application behavior has not been changed.

## What the supplied material establishes

All 36 images in `whatsappfotos/` were visually inspected: three overview images and 33 numbered book photographs. The supplied WhatsApp conversation explains that the numbered photographs revise an older 32-day division into 33 days, with smaller readings intended for beginners and slower readers. The 15-day table is a separate division. The seven-day division is mentioned but its seven exact boundaries are not supplied. Two- and three-day completion is mentioned as another reading pace, without an accompanying division.

Use the numbered photographs as the source for the revised 33-day plan. Keep the old 32-day calendar only as historical reference. A 15-day plan means 15 consecutive reading days, not a half-calendar-month. A 33-day plan means 33 consecutive reading days, not a calendar month. Eleven uninterrupted 33-day traversals take 363 days; the app should count actual completed traversals rather than promise an annual total.

The explicit user requirement applies to every plan: each Sekine assignment requires all 19 repetitions from its individual reader. Other people's repetitions cannot contribute to that person's assignment.

## Source inventory

| Image time | Role |
| --- | --- |
| 01.23.58 | Handwritten planning notes, including the revised Münâcât boundaries; less precise than the numbered photos. |
| 01.27.34 | 15-part table. Sekine is portion 8, explicitly 19 times. |
| 01.29.21 | Older 32-part dated calendar. Sekine is portion 19. This is not the revised 33-part plan. |
| 01.55.33–02.08.09 | One photograph for each numbered portion 1–33. Sekine remains portion 19. |

The photographs and app use different printed editions/page numbering. For example, Evrâd begins on photographed page 85, whereas the app's section includes title material from page 87 and the prayer begins on page 89. Match text, not page numbers. The photos identify starts; most intervening pages and the final ending are not photographed. Matching a start does not certify that the editions contain identical full text between starts.

## Revised 33-part source map

Each portion runs up to, but does not include, the next portion's start. Preserve the closing refrain with the Cevşen bab it closes. Include Bismillah with the prayer it introduces. The Arabic words below identify boundaries; they are not newly authored prayer text.

Coordinates refer to the current `apps/web/src/lib/content/hizbulhakaik.data.json`, using zero-based section/block/line/invocation indexes. They are research coordinates, not permanent runtime IDs. Where only a section or block is given, start at its beginning. Leading titles/editorial introductions need a separate display decision; preserve them in free reading.

| Portion | Reading / start | Photograph time | Current source start |
| --- | --- | --- | --- |
| 1 | Tevbe/İstiğfar and Yasin | 01.55.33 | Section 0; continues through section 1 |
| 2 | Fetih and Rahman | 01.55.57 | Section 2; continues through section 3 |
| 3 | Haşir ending, Tebareke, Nebe and concluding Qur’an readings/prayer | 01.56.35 | Section 4; continues through section 6; see Âmenerresûlü discrepancy below |
| 4 | Cevşen opening and babs 1–20 | 01.56.59 | Section 7, block 0 |
| 5 | Cevşen, “Fe-es’elüke bi-esmâike yâ Aliyy…”; babs 21–40 | 01.57.43 | Section 7, block 18 |
| 6 | Cevşen babs 41–60 | 01.58.22 | Section 7, block 38 |
| 7 | Cevşen babs 61–80 | 01.58.58 | Section 7, block 58 |
| 8 | Cevşen babs 81–100 and closing prayer | 01.59.49 | Section 7, block 78 |
| 9 | Evrâd-ı Kudsiyye opening | 02.00.45 | Section 8 |
| 10 | Âyetü’l-Kürsî, “Allâhü lâ ilâhe illâ hüve…” | 02.01.04 | Section 8, block 0, line 8, invocation 2 |
| 11 | “Merhaben merhaben bi’s-sabâh…” | 02.01.25 | Section 8, block 0, line 12, invocation 9 |
| 12 | “Tâ Sîn Mîm ve neûzü billâhi…” | 02.01.42 | Section 8, block 0, line 17 |
| 13 | “Es-sâbirîne ve’s-sâdikîne…” | 02.01.58 | Section 8, block 0, line 21, invocation 2 |
| 14 | Delâil-in Nur opening | 02.02.15 | Section 9 |
| 15 | “Allâhümme salli alâ seyyidinâ Muhammedin şecerati’l-asli’n-nûrâniyye…” | 02.02.43 | Section 9, block 4 |
| 16 | “Allâhümme salli alâ men minhü’nşakkati’l-esrâr…” | 02.03.09 | Section 9, block 7 |
| 17 | “Allâhümme salli salâten kâmileten…” | 02.03.23 | Section 9, block 10 |
| 18 | “Allâhümme salli alâ seyyidinâ Muhammedini’s-sâbiki ile’l-enâm…” | 02.03.57 | Section 9, block 18 |
| 19 | Sekine — 19 personal repetitions, from Bismillah | 02.04.15 | Section 10; opening takbirs precede the repeated passage |
| 20 | Münâcât-ı Veysel Karani and İsm-i A‘zam prayers | 02.04.25 | Section 11; continues through sections 12–13 |
| 21 | Münâcât-ül Kur’an: Fatiha through the passage before İbrahim | 02.04.44 | Section 14, block 0 |
| 22 | Münâcât: İbrahim through the passage before Lokman | 02.05.03 | Section 14, block 12 |
| 23 | Münâcât: Lokman through the passage before Kamer | 02.05.15 | Section 14, block 26 |
| 24 | Münâcât: Kamer through the passage before Nebe | 02.05.43 | Section 14, block 42 |
| 25 | Münâcât: Nebe to the end | 02.05.57 | Section 14, block 60 |
| 26 | Tahmidiye | 02.06.30 | Section 15 |
| 27 | Hülasat-ül Hülasa opening | 02.06.52 | Section 16, block 0 |
| 28 | “Lâ ilâhe illallâh bi-elsineti’l-ahyâri ve’l-asfiyâ…” | 02.07.05 | Section 16, block 6 |
| 29 | “Lâ ilâhe illallâh el-vâcibü’l-vücûdi’l-vâhidü’l-ehad zü’l-kemâlât…” | 02.07.17 | Section 16, block 16 |
| 30 | “Lâ ilâhe illallâh el-melikü’l-hakku’l-mübîn… bi-şehâdeti sâhibi’l-kâinât…” | 02.07.28 | Section 16, block 27; distinguish from the similar earlier opening in block 26 |
| 31 | İstiğfar ve Dua, “İlâhî ez-zünûbü ahrasetnî…” | 02.07.45 | Section 16, block 28, line 3 (Bismillah); main text at line 4 |
| 32 | Tesbih ve Dua, “Sübhâneke lâ uhsî senâen aleyke…” | 02.07.58 | Section 16, block 28, line 9 (Bismillah); main text at line 10 |
| 33 | Final dua, “Yâ Allâh, yâ Rahmân…” | 02.08.09 | Section 16, block 28, line 15 (Bismillah); main text at line 16; continues to the current source's end |

Important differences from the old 32-day calendar:

- The revised Münâcât division has five portions, starting at Fatiha, İbrahim, Lokman, Kamer and Nebe. The old table uses four with different starts.
- Tahmidiye consequently moves from portion 25 to 26, and the final prayer from 32 to 33.
- Evrâd portions 12 and 13 have revised text anchors.
- The photographed Cevşen starts for portions 6, 7 and 8 follow refrains numbered 41, 61 and 81. Their next bab openings match app babs 42, 62 and 82. Do not silently substitute the old spreadsheet's 41/61/81 starts. **Resolved 2026-10-04:** the photos' own labels read “8. Bölüm – Cevşen 81'den – 100'e” (the 2026 calendar agrees: 1–20 / 21–40 / 41–60 / 61–80 / 81–100), so the starts are babs 21, 41, 61 and 81 (blocks 18, 38, 58, 78 — blocks 0 and 14 each hold two babs).
- The app has 99 Cevşen display blocks containing all 100 babs. Display-block indexes are not bab numbers; some blocks contain multiple babs. Split by verified text boundaries, not by arithmetic on block numbers.
- Portions 31–33 already exist within the app's last Hülasat section. Adding duplicate copies would repeat text.

## The supplied 15-day plan

| Portion | Supplied table's division |
| --- | --- |
| 1 | İstiğfar and Qur’an readings through the Qur’an section's concluding prayer |
| 2 | Cevşen babs 1–50 |
| 3 | Cevşen babs 51–100 and closing prayer |
| 4 | Evrâd opening to “Merhaben merhaben bi’s-sabâh” |
| 5 | “Merhaben…” to the end of Evrâd |
| 6 | Delâil opening to “Allâhümme salli alâ men minhü’nşakkati’l-esrâr” |
| 7 | That salawat to the end of Delâil |
| 8 | Sekine — 19 repetitions by its individual reader |
| 9 | Veysel Karani, Hizb Duası and İsm-i A‘zam prayers, as named in the table; confirm exact inclusion against the app's sections 11–13 |
| 10 | Münâcât: Fatiha to Sâffât |
| 11 | Münâcât: Sâffât to the end |
| 12 | Complete Tahmidiye |
| 13 | Hülasat opening to “Lâ ilâhe illallâh el-vâcibü’l-vücûd…”; the short table wording is ambiguous between repeated openings |
| 14 | That Hülasat boundary to the end of Hülasat proper, before the final prayer sequence |
| 15 | Tazarru ve Niyaz 1–3: Geylani prayer and the remaining final prayers |

Do not construct this plan merely by merging every two or three portions of the revised 33-day plan. Its supplied boundaries are different. The 15-day table's Hülasat split needs a longer identifying phrase: the app contains several similar “el-vâcibü’l-vücûd” openings.

## Recommended behavior

Three approaches were considered:

1. **Fixed daily rotation with personal catch-up — recommended for groups.** One defined portion per calendar day, everyone advances at the same group-local daily boundary, with stable starting offsets. Today and missed readings remain separately visible. This follows the dated list and keeps the group aligned.
2. **Advance only on completion.** Comfortable for a private self-paced plan, but members drift apart and a dated group timetable stops describing actual assignments.
3. **Automatically rebalance or reassign whenever somebody misses a day.** Can improve coverage temporarily but changes people's commitments unpredictably and obscures who actually completed each reading. Avoid as the default.

The shared-daily versus individual-advance preference was asked in the task. Until answered, approach 1 is a proposed default, not a confirmed description of the family's practice.

### Plans and day boundaries

- Separate the book's 17 navigation headings from a plan's 7, 15 or 33 assigned portions. One portion may span multiple headings or cover only part of one heading.
- Define immutable, versioned plans with explicit start/end text references and per-component repetition rules. Keep the existing source text as the canonical content. Use one shared manifest for client and server.
- Start with the faithfully mapped 33-day plan. Add the 15-day plan after resolving its ambiguous split. The seven-day plan needs its actual seven divisions, or an explicitly accepted app-designed alternative. Two/three-day plans need their own reviewed groupings too.
- Advance once per local calendar day in the group's saved timezone, defaulting to midnight. Daylight-saving changes must not cause double steps or skipped steps. Show the next change as a local date/time, not a fractional-hour interval.
- Let the organiser choose a start date. Generate a rolling calendar from the start date and plan length; do not hardcode the dates in the 2026 spreadsheet or restart a 33-day plan on the first of each month.
- A new member starts with an assignment for today or a chosen future start date, with no inherited pre-join arrears. Pick the least occupied current position, retaining the existing deterministic spacing rule and stable existing positions.
- Every member sees each plan portion once in every P consecutive assigned days. With a 33-day plan, position 33 wraps to position 1 on the next day.

### Missed readings and membership changes

- Preserve each occurrence with its original date, part, plan version and owner. Today's assignment advances even if older work remains unfinished. After P days, the next dated traversal can begin while the previous traversal still has outstanding readings.
- Label these separately: scheduled traversal, completed personal hatim, and missed readings. An elapsed 33 days is not automatically a completed hatim.
- Late completion closes the original assignment and original personal traversal. It never shifts future dates or counts for the next traversal.
- Repeated occurrences of the same part in different traversals remain separate obligations. Reading it once cannot complete several missed occurrences at once.
- Leaving stops future assignments and preserves history. Rejoining creates a new membership; retain earlier outstanding work and any Sekine count associated with it.
- Keep existing group records on the old plan version by default. Never reinterpret an old `partIndex` using a new 33-part manifest. A switch requires an explicit effective date, a new schedule epoch and preserved old history.

### Sekine: a hard personal requirement

- The photo and existing source both state “Besmeleden itibaren 19 defa okunur”: repeat from Bismillah. Present the opening takbirs separately from the repeated passage; do not restart the opening takbirs on every lap merely because they share one display block.
- Every Sekine occurrence owns an independent counter, 0–19, for one person. This remains true when Sekine is a component of a larger seven-day portion.
- A clear “One repetition completed” action increments it. Return to the Bismillah for the next repetition. Show “8 / 19 completed”; save progress immediately and restore it when reopening the reader.
- Allow a correction/undo for an accidental tap. Provide an explicit entry for repetitions already read from the physical book; record it as the reader's self-report, with the same 0–19 limit.
- Do not count scrolling, reopening a page, or audio playback as a completed reading.
- The server rejects completion below 19. Client-side button disabling alone is insufficient. Retried requests must not add duplicate repetitions, and simultaneous updates from two devices must not overwrite progress.
- Repetitions are never pooled between members, moved to another assignment, or automatically reused next cycle. Nineteen completed repetitions count as one completed Sekine portion, not 19 group portions.
- Interpretation used here: 19 every time that person is assigned Sekine. The calendar's “one person (every day)” can describe a full group's daily Sekine coverage; it does not establish that every member must read Sekine daily in addition to another assigned portion. If that additional daily practice is intended, model it separately and explicitly.

### Honest personal and collective progress

- A personal completed hatim requires every planned portion for that personal traversal, including 19 repetitions on each Sekine component.
- For cumulative group equivalents, count completed occurrences by distinct portion within the same plan/version epoch. The number of complete coverage sets is the smallest of those per-portion counts. Each completed occurrence can contribute once. Show the remaining per-portion coverage so repeated completions of one part cannot conceal a missing part.
- Keep dated daily coverage separate from cumulative equivalents. A daily group hatim requires all distinct portions for that date, including a complete personal Sekine assignment. A catch-up completion belongs to its original date and may complete an older daily record.
- With P members in distinct positions and everyone completing their portion, the group covers P distinct portions per day and each person finishes a traversal in P days. Fewer than P members means daily full coverage is not guaranteed. More than P means some daily portions repeat. Never infer a full reading simply from member count or total taps.
- Future optional help can record extra readings for collective coverage, but cannot erase another person's unfinished personal assignment or supply some of their Sekine repetitions.

### Reader and group improvements

- “Today's reading” opens the precise start and stops at the precise end, with human-readable boundaries such as “Münâcât: İbrahim → before Lokman”.
- Save the reader's place separately for each dated assignment. Support cross-section portions and slices inside a line/invocation; the existing whole-section reader is insufficient.
- Display “Today”, “Catch-up” and a plan calendar. Keep personal progress and group coverage separately labelled.
- A group overview shows who is assigned each portion and which portions lack coverage. Keep reminders private and opt-in; avoid ranking members by missed readings.
- Plan descriptions explain the amount of reading, including Sekine ×19. Do not describe all portions as equal effort: the 33-part plan improves balance but still contains variable lengths, and Tahmidiye remains a substantial single portion.
- Share/export the generated timetable through an explicit user action. Do not send WhatsApp messages automatically.

## Content questions that must remain visible

1. **Âmenerresûlü:** the older 32-day table includes it in the Qur’an portion. Its opening was not found after diacritic-insensitive comparison of the current Hizbul Hakaik JSON, nor in the searched Hizbul content/scripts text. The photos show starts rather than the intervening pages. Confirm the intended passage/inclusion and use a verified source before calling the digital plan an exact match. Do not silently omit it or generate Arabic from memory.
2. **Cevşen boundaries:** confirm that numbered photo labels mean the next bab after the marked closing refrain. Resolved 2026-10-04 in favour of 21–40 / 41–60 / 61–80 / 81–100 (see above).
3. **15-day Hülasat boundary:** identify the exact occurrence of the repeated “el-vâcibü’l-vücûd” opening.
4. **Seven-day division:** only its existence is given. Do not label an invented grouping as the supplied seven-day practice.

## Implementation scope and verification

The main changes belong in the reading-plan manifest, `readingRotation.ts`, `readingGroups.service.ts`, the Prisma reading models, API types/routes, group creation/detail screens, reader bounds and reader progress handling. Existing Cevşen group behavior is a separate feature and should retain its contracts.

Before implementation is considered complete, verify:

- Exact 33/15/7 portion counts for each released plan, ordered nonempty ranges, no unintended omissions/overlap, complete Cevşen bab/refrain coverage and all final prayers.
- All numbered-photo anchors exist exactly where the versioned manifest expects; text drift fails validation rather than opening a different passage.
- Thirty-three consecutive dates traverse all 33 parts once per member. Day 34 wraps correctly. DST, leap days and month/year boundaries preserve one assignment per local date.
- Joining/leaving/rejoining never rewrites another member's assignment or erases historical work.
- Missing a day or completing a previous cycle late does not move the shared schedule. Duplicate API requests do not duplicate assignments or completion credit.
- Sekine at 18/19 cannot complete; 19/19 completes once; saved progress survives reopening; other users cannot update it; a fresh occurrence starts at zero; offline/retry handling cannot inflate it.
- Repeated completions of the same portion cannot produce a false collective full reading. Every Sekine counts once only after 19 repetitions from its owner.
- The reader opens and closes all cross-section and within-line boundaries correctly, including the final three prayers embedded in Hülasat.
- Old groups continue resolving the old 17-part plan, with their history intact. Migration is additive and independently tested before deployment.

This review changes documentation only. It does not claim that new schedules, repetition tracking, content changes or migration have been implemented or tested in the running app.
