import { describe, expect, it } from 'vitest';
import type { ReadingAssignment } from '@/api/readingGroups.api';
import { hizbProgress } from './hizbProgress';

const assignment = (partIndex: number, status: ReadingAssignment['status']): ReadingAssignment => ({
	id: `assignment-${partIndex}`,
	cycleId: 'cycle',
	ordinal: 0,
	partIndex,
	rotationStep: 0,
	assignedAt: '2026-09-21T00:00:00Z',
	completedAt: status === 'completed' ? '2026-09-21T01:00:00Z' : null,
	status
});

describe('Hizb section progress', () => {
	it('places rotated assignments under their section number, including unread and unreleased sections', () => {
		const completed = assignment(16, 'completed');
		const pending = assignment(0, 'pending');
		const parts = hizbProgress(17, [completed, pending]);
		expect(parts).toHaveLength(17);
		expect(parts[0]).toEqual({ partIndex: 0, status: 'pending', assignment: pending });
		expect(parts[1]).toEqual({ partIndex: 1, status: 'upcoming', assignment: undefined });
		expect(parts[16]).toEqual({ partIndex: 16, status: 'completed', assignment: completed });
	});

	it('starts a new cycle with no completed sections carried over', () => {
		expect(hizbProgress(17, []).every(part => part.status === 'upcoming')).toBe(true);
	});
});
