export type RoundCardProps = {
	/** "3. Tur" — the round's own heading. */
	label: string;
	/** Either "tamamlandı" or the missed count, already worded by the caller. */
	missedLabel: string;
	isComplete: boolean;
	onPress: () => void;
	percent: number;
	/** "42/100", the round's read count against the hundred. */
	readLabel: string;
	/** When it ran, in the cadence's own words — "dün", "geçen hafta", or a date. */
	whenText: string;
};
