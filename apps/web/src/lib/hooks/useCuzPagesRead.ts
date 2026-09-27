import { type CuzPagination, readCuzPagesRead } from '@/lib/utils/cuzPagesRead';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';

/** A cüz in a group, in the round whose progress counts — see `cuzPagesRead`. */
export type CuzProgressKey = { groupId: string; cuzNumber: number; roundIndex: number };

export const cuzProgressId = ({ cuzNumber, groupId, roundIndex }: CuzProgressKey) =>
	`${groupId}:${cuzNumber}:${roundIndex}`;

/**
 * Pages read in each cüz this round, in the reader's pagination — Ana sayfa's "4/20 s". The
 * count is device-local (`cuzPagesRead`), so this reads it for every cüz asked about, and again
 * whenever the screen regains focus: the reader it came back from is where pages are read.
 */
export const useCuzPagesRead = (
	userId: string | null | undefined,
	keys: readonly CuzProgressKey[],
	pagination: CuzPagination
) => {
	const isFocused = useIsFocused();
	const [pages, setPages] = useState<Record<string, number>>({});
	// A string, so a new array with the same cüz in it does not read the store again.
	const signature = keys.map(cuzProgressId).join(',');

	useEffect(() => {
		if (!userId || !isFocused || signature === '') {
			return;
		}

		let isCurrent = true;
		const wanted = signature.split(',').map(id => {
			const [groupId = '', cuzNumber = '0', roundIndex = '0'] = id.split(':');

			return { cuzNumber: Number(cuzNumber), groupId, roundIndex: Number(roundIndex) };
		});

		void Promise.all(
			wanted.map(
				async key =>
					[
						cuzProgressId(key),
						await readCuzPagesRead(userId, key.groupId, key.cuzNumber, key.roundIndex, pagination)
					] as const
			)
		).then(entries => {
			if (isCurrent) {
				setPages(Object.fromEntries(entries));
			}
		});

		return () => {
			isCurrent = false;
		};
	}, [isFocused, pagination, signature, userId]);

	return pages;
};
