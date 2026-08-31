import { createContext } from 'react';

/**
 * The floating tab bar's measured height — **the bar itself, and nothing else**.
 *
 * It carried the height *plus* a courtesy gap for a while, which was fine for the one caller
 * that wanted both and wrong for everyone else: the reader adds its own symmetric padding
 * around the action bar, so the baked-in gap landed on top of it and left 30pt under the
 * buttons against 12 above them. A screen that wants air adds `TAB_BAR_CONTENT_GAP`; a screen
 * that is placing something flush against the bar uses this on its own.
 *
 * Zero when there is no bar (the auth stack, onboarding), which is also what tells a screen
 * it still owns its own `bottom` safe-area edge.
 */
export const TabBarOffsetContext = createContext(0);

/**
 * The breathing room scrolling content leaves above the bar, matching the design's `.sc`
 * bottom padding. Not part of the height: reserving the bar's height twice is what left a
 * screenful of dead space under long content.
 */
export const TAB_BAR_CONTENT_GAP = 18;
