import type { TomorrowTask } from '@/lib/utils/homeTasks';

export interface HomeDoneCardProps {
	/** How many shares today held — every one of them read. */
	count: number;
	/** "Yarın sıradaki" — absent when no group's next round opens tomorrow. */
	tomorrow: TomorrowTask | null;
}
