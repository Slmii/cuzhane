export type ReaderBabMapProps = {
	/** Where the reader is now — the tall ink tick. Follows the finger while scrubbing. */
	currentBab: number;
	/** Read this round, from `GroupBab`. Wins over ownership: a read bab shows as read. */
	readBabNumbers: number[];
	/** The viewer's share this round, rotated block plus anything volunteered from the pool. */
	myBabNumbers: number[];
	/** Still unclaimed in the pool. */
	poolBabNumbers: number[];
};
