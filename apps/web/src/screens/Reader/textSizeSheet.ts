/**
 * Whether the text-size sheet is open, and how to close it — shared by the two reading screens.
 *
 * **There is no state here, and that is the point.** The control that opens the sheet lives in
 * the navigator's bar (`ReaderToolbar`), outside the screen, so it asks through the route. Once
 * the "Aa" chip inside the header row was gone — it sat in the band the transparent native header
 * draws over, and never received a tap — nothing in either screen opened the sheet any more, and
 * the `useState` both were keeping was only ever written to `false`.
 *
 * Kept as one function rather than four lines twice: the two screens are the same sheet reached
 * the same way, and the pair drifting is exactly how one of them would end up unable to close.
 */
interface TextSizeNavigation {
	setParams: (params: { shouldOpenTextSize?: boolean }) => void;
}

interface TextSizeParams {
	shouldOpenTextSize?: boolean;
}

export const textSizeSheet = (navigation: TextSizeNavigation, params: TextSizeParams | undefined) => ({
	/** Cleared on dismissal, or the param would reopen the sheet on the next render. */
	close: () => navigation.setParams({ shouldOpenTextSize: undefined }),
	isVisible: params?.shouldOpenTextSize === true
});
