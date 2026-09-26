# Personal Hizb plan group overview

The user approved bringing the clarity of the existing VRT shared board to personal-plan groups such as Hhh, while retaining the daily plan.

- Show shared daily coverage and the number of active readers who finished today's assignment at the top.
- Keep today's reading action and next release time prominent. Show personal plan day, completed assignments in the current traversal, and missed readings together. Explicitly distinguish no previous backlog from today's still-pending assignment; provide a direct action to the oldest missed reading across all history pages.
- Show the book's 33 canonical portions grouped by work. Distinguish read, partly read, scheduled and no reader today; outline the current reader's portions.
- Show today’s readers and their completion states directly (first six, with expansion). Default personal history to missed readings, with an option to include completed readings.
- Tap a portion to expand its description and today's readers, respecting existing name privacy. Open only the user's own assignment from this detail.
- Map 7-, 15- and 33-day plans through the existing canonical spans. The 33-cell board describes the book, not the number of days in every reader's plan.
- Return today's exact completed span union from the API, including completed readings by departed readers. Do not reconstruct completed coverage from the active member list.
- Preserve enrollment, catch-up, history, inactivity, repetition gates and individual-reading privacy. No shared-pool claims or changes to plan scheduling.
- Keep the existing screen usable against older servers; show the board only once authoritative span data is available.

Validation: unit cases for mixed-plan overlap, partial coverage, empty cells, current-reader outlines and pending Sekine; service regression for departed readers and date isolation; client suite, types and focused lint. A device visual check remains separate from these automated checks.
