import type { MushafVerse } from '@/lib/content/mushaf';
import type { MushafPlace } from '@/lib/content/mushafPlaces';
import type { CuzPagination } from '@/lib/utils/cuzPagesRead';

/** A pick: the page to open, and the ayah on it when one was chosen — to scroll to and mark. */
export type GoHandler = (place: MushafPlace, verse?: MushafVerse) => void;

export interface MushafGoSheetProps {
	isVisible: boolean;
	onClose: () => void;
	/** Whichever the reader is showing — every page number in the sheet is counted in it. */
	pagination: CuzPagination;
	/** Where the reader is: the "Şu an" line, and the sura, ayah, cüz and page the tabs open on. */
	cuzNumber: number;
	pageIndex: number;
	/**
	 * The ayah the reader was last sent to, when it is on the page showing — "Şu an" and the ayah
	 * grid mark it rather than the page's first ayah.
	 */
	currentVerse?: MushafVerse;
	/** A place was picked. Closing the sheet and moving the reader are both the caller's. */
	onGo: GoHandler;
}
