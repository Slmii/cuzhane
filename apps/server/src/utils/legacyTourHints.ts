/**
 * What an account that finished the old guided tour (raw `hasSeenTour`) counts as seen: the welcome
 * only. The screen hints are new to everyone — so much changed since the tour that every existing
 * reader is shown them once. **Frozen.**
 */
export const LEGACY_TOUR_HINT_IDS: readonly string[] = Object.freeze(['welcome']);
