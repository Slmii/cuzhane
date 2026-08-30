export type ReaderSizeSliderProps = {
	value: number;
	min: number;
	max: number;
	/** Every frame of the drag — for the preview, which has to follow the finger. */
	onDraft: (size: number) => void;
	/** Once, on release. This is the one that persists. */
	onChange: (size: number) => void;
};
