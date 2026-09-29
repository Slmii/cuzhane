import type { GroupSummary } from '@/lib/types/domain';

export type HizbDiscoverCardProps = {
	/** A Hizb group on personal plans (`hizbPlan` set), as Keşfet lists it. */
	group: GroupSummary;
	onPress: () => void;
};
