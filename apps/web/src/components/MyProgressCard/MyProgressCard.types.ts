import type { MyProgress } from '@/lib/types/domain';

export interface MyProgressCardProps {
	progress: MyProgress;
	onPress: () => void;
	/**
	 * A hatim's line (Q3): the rate stands bare and "bu hatim · N tur" follows it. A hatim is
	 * one bounded run, so naming its span is a whole answer — the reason the Cevşen line
	 * carries none does not apply.
	 */
	isHatim?: boolean;
}
