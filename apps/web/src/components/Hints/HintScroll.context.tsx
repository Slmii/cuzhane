import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { ScrollView, View } from 'react-native';

type HintScroll = {
	/** The scroll view, to scroll. */
	scrollRef: RefObject<ScrollView | null>;
	/** Its content view (`innerViewRef`), to measure a target's place in the content against. */
	innerRef: RefObject<View | null>;
};

const HintScrollContext = createContext<HintScroll | null>(null);

/**
 * A screen's scroll view, handed to the hint targets inside it — so a hint whose element sits
 * below the fold can bring it into view before the spotlight is drawn (see `HintTarget`). It
 * scrolls the target until it stands 96pt under the scroller's top, as the design's tour did.
 *
 * Only a screen that has such a hint needs one. Everywhere else a target measures where it is,
 * and a hint whose target is off screen waits.
 */
export const HintScrollProvider = ({ children, innerRef, scrollRef }: HintScroll & { children: ReactNode }) => (
	<HintScrollContext.Provider value={{ innerRef, scrollRef }}>{children}</HintScrollContext.Provider>
);

export const useHintScroll = () => useContext(HintScrollContext);
