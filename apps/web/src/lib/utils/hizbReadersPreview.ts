import type { HizbReadingState } from '@/api/hizbReading.api';

type Reader = HizbReadingState['members'][number];

/** Rows a group's progress card shows before "Tümünü gör" — a group of four or fewer shows everyone. */
export const READERS_PREVIEW_ROWS = 4;

/** Read first (newest first), then begun, then still waiting. */
const rank = (reader: Reader) => (reader.completed ? 0 : reader.started ? 1 : 2);

/**
 * "Grup ilerlemesi" for a group of any size: how many readers read today, and a few of them —
 * the viewer first, then the latest readers, then those who began, then those still to read.
 *
 * With names hidden from the viewer, rows of "Bir üye" would say nothing: only the viewer's own
 * row is shown, and the others who read are a count (`othersRead`). The full list is one tap away.
 */
export const readersPreview = (
	members: readonly Reader[],
	{ limit = READERS_PREVIEW_ROWS, namesHidden }: { limit?: number; namesHidden: boolean }
) => {
	const read = members.filter(member => member.completed).length;
	const me = members.find(member => member.isMe);
	const others = members
		.filter(member => !member.isMe)
		.sort(
			(a, b) =>
				rank(a) - rank(b) ||
				// Newest reader first; ISO times sort as text. A time missing (an older server) goes last.
				(b.completedAt ?? '').localeCompare(a.completedAt ?? '')
		);
	const rows = namesHidden ? (me ? [me] : []) : [...(me ? [me] : []), ...others].slice(0, limit);

	return {
		hasMore: members.length > rows.length,
		isAllRead: members.length > 0 && read === members.length,
		othersRead: read - (me?.completed ? 1 : 0),
		read,
		rows,
		total: members.length,
		waiting: members.length - read
	};
};
