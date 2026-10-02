import { useGetReadingPlacesFor } from '@/lib/hooks/useReadingPlaces';
import { type CuzPagination, readCuzPagesRead } from '@/lib/utils/cuzPagesRead';
import { placeIn } from '@/lib/utils/readingPlaces';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';

/**
 * A cüz in a group, in the round whose progress counts — see `cuzPagesRead`. `isPlan` marks a Şahsi
 * reading's, which the server keeps no count for.
 */
export type CuzProgressKey = { groupId: string; cuzNumber: number; roundIndex: number; isPlan: boolean };

export const cuzProgressId = ({ cuzNumber, groupId, roundIndex }: Omit<CuzProgressKey, 'isPlan'>) =>
	`${groupId}:${cuzNumber}:${roundIndex}`;

/**
 * Pages read in each cüz this round, in the reader's pagination — Ana sayfa's "4/20 s". The higher
 * of the server's count (`readingPlaces`, a group's cüz only) and the device's (`cuzPagesRead`),
 * which this reads for every cüz asked about, and again whenever the screen regains focus: the
 * reader it came back from is where pages are read.
 */
export const useCuzPagesRead = (
	userId: string | null | undefined,
	keys: readonly CuzProgressKey[],
	pagination: CuzPagination
) => {
	const isFocused = useIsFocused();
	const [devicePages, setDevicePages] = useState<Record<string, number>>({});
	// A string, so a new array with the same cüz in it does not read the store again.
	const signature = keys.map(cuzProgressId).join(',');
	const groupIds = useMemo(() => [...new Set(keys.filter(key => !key.isPlan).map(key => key.groupId))], [keys]);
	const serverQueries = useGetReadingPlacesFor(groupIds);

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
				setDevicePages(Object.fromEntries(entries));
			}
		});

		return () => {
			isCurrent = false;
		};
	}, [isFocused, pagination, signature, userId]);

	return Object.fromEntries(
		keys.map(key => {
			const id = cuzProgressId(key);
			const cached = serverQueries[groupIds.indexOf(key.groupId)]?.data;
			const place = key.isPlan ? undefined : placeIn(cached, key.roundIndex, key.cuzNumber);
			const serverPages = (pagination === 'husrev' ? place?.husrevPagesRead : place?.textPagesRead) ?? 0;

			return [id, Math.max(devicePages[id] ?? 0, serverPages)];
		})
	);
};
