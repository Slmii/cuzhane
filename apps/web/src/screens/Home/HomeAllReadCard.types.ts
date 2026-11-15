export interface HomeAllReadCardProps {
	/** This round's shares, every one of them finished — "3 / 3 pay okundu". */
	count: number;
	/** "Yeni grup kur" — a running group rolls over by itself, so a new one is the way on. */
	onNewGroup: () => void;
}
