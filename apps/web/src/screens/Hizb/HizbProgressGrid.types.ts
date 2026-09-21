import type { ReadingAssignment } from '@/api/readingGroups.api';

export interface HizbProgressGridProps {
	numberOfParts: number;
	assignments: ReadingAssignment[];
	onPressPart?: (partIndex: number, assignment?: ReadingAssignment) => void;
}
