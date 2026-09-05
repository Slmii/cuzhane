import type { ProfileStats } from '@/lib/types/domain';

export interface StreakCardProps {
	streakDays: number;
	longestStreakDays: number;
	/** The reader's last thirty days, oldest first — the strip reads this week out of it. */
	last30Days: ProfileStats['last30Days'];
}
