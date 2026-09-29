import { useState } from 'react';

/** A counter belongs to the reader session/round, not the currently displayed page. */
export const useDelailSession = (session: string) => {
	const [counts, setCounts] = useState<Record<string, number>>({});
	return {
		count: counts[session] ?? 0,
		disabled: false,
		sessionOnly: true,
		onChange: (count: number) => setCounts(previous => ({ ...previous, [session]: count }))
	};
};
