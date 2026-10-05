import type { CevsenInvocation } from '@/lib/content/cevsen';
import type { ReaderNumerals, ReaderTextFont } from '@/lib/types/domain';
import type { GestureResponderEvent, LayoutChangeEvent, TextLayoutEvent } from 'react-native';

export interface ReaderBodyProps {
	/** 1–100. Bab 1 carries the besmele, bab 100 the du'a that follows it. */
	babNumber: number;
	font: ReaderTextFont;
	/** The reader's chosen size in points, before the per-face scale is applied. */
	fontSize: number;
	numerals: ReaderNumerals;
	/**
	 * A verse mark was long-pressed. Both readers open `MealSheet` with it; the mark is the
	 * only pressable thing in the text, for the reasons spelled out in the component.
	 */
	onLongPressInvocation: (invocation: CevsenInvocation) => void;
	/**
	 * A short tap on the invocations' paragraph, and on a verse mark — given only to a live
	 * reading's reader, who shows followers where they are. The paragraph's tap is resolved to an
	 * invocation by where it landed (`useCevsenBandGeometry`); left out, nothing changes.
	 */
	onPressParagraph?: (event: GestureResponderEvent) => void;
	onPressMark?: (n: number) => void;
	/** The invocations' paragraph: where it sits, and where its lines fell (`cevsenParagraph`). */
	onParagraphLayout?: (event: LayoutChangeEvent) => void;
	onParagraphTextLayout?: (event: TextLayoutEvent) => void;
}
