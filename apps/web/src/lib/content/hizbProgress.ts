import type { ReadingAssignment } from '@/api/readingGroups.api';

/** Section order stays fixed even when a member's assignments rotate around the book. */
export const hizbProgress = (numberOfParts: number, assignments: ReadingAssignment[]) =>
	Array.from({ length: numberOfParts }, (_, partIndex) => {
		const assignment = assignments.find(item => item.partIndex === partIndex);
		return { partIndex, status: assignment?.status ?? ('upcoming' as const), assignment };
	});
