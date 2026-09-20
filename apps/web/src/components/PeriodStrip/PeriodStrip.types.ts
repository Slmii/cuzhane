import type { GroupCycle, MyProgressPeriod } from '@/lib/types/domain';

export interface PeriodStripProps {
	periods: MyProgressPeriod[];
	cycle: GroupCycle;
	/** The group's own zone — which day a round started on is the group's question, not the device's. */
	timezone: string;
}
