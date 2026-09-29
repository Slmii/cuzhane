export type RoundCardProps = {
	/** "3. Tur" — the round's own heading. */
	label: string;
	/** Either "tamamlandı" or the missed count, already worded by the caller. */
	missedLabel: string;
	/**
	 * A clay line under the bar saying what the round left unread — HZ4's "16, 24 ve 31 okunmadı".
	 * The Hizb's alone: a Cevşen round misses babs by the dozen, and its chip already counts them.
	 */
	missedNote?: string;
	isComplete: boolean;
	onPress: () => void;
	percent: number;
	/** "42/100", the round's read count against the parts it had to cover. */
	readLabel: string;
	/** When it ran, in the cadence's own words — "dün", "geçen hafta", or a date. */
	whenText: string;
};
