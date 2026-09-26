import { useState } from 'react';

/** Kept by the reader screen, so turning a page never discards the current session's count. */
export const useIstighfarSession = (session: string) => {
	const [readings, setReadings] = useState<Record<string, { count: number; target: number }>>({});
	return {
		...(readings[session] ?? { count: 0, target: 11 }),
		disabled: false,
		sessionOnly: true,
		onChange: (patch: { istighfarRepetitions?: number; istighfarTarget?: number }) => {
			setReadings(previous => {
				const current = previous[session] ?? { count: 0, target: 11 };
				return {
					...previous,
					[session]: {
						count: patch.istighfarRepetitions ?? current.count,
						target: patch.istighfarTarget ?? current.target
					}
				};
			});
		}
	};
};
