import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { ScrollView, View } from 'react-native';

type TourScroll = {
	/** The scroll view, to scroll. */
	scrollRef: RefObject<ScrollView | null>;
	/** Its content view (`innerViewRef`), to measure a target's place in the content against. */
	innerRef: RefObject<View | null>;
};

const TourScrollContext = createContext<TourScroll | null>(null);

/**
 * A screen's scroll view, handed to the tour targets inside it — so a stop whose element sits
 * below the fold can bring it into view before the spotlight is drawn (see `TourTarget`). The
 * design's own tour does the same: it scrolls the target's scroller until the target stands 96pt
 * under its top.
 *
 * Only a screen that has such a stop needs one. Everywhere else a target measures where it is.
 */
export const TourScrollProvider = ({ children, innerRef, scrollRef }: TourScroll & { children: ReactNode }) => (
	<TourScrollContext.Provider value={{ innerRef, scrollRef }}>{children}</TourScrollContext.Provider>
);

export const useTourScroll = () => useContext(TourScrollContext);
