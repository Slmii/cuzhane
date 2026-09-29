/**
 * The app's last few steps — screens, navigation actions, the app going to the background and
 * back — kept so a bug report can say what happened just before it. Sent only with feedback the
 * user chooses to send (`FeedbackSheet`).
 *
 * **Bounded and in memory.** The newest `MAX_BREADCRUMBS` lines, oldest dropped first, gone when
 * the app is closed: a few kilobytes at most, however long it runs. **Never personal**: route
 * names and the numbers in them ("bab 97"), never a name, an id or any text the user reads or
 * types.
 */
export const MAX_BREADCRUMBS = 30;
/** Longer lines are cut, so one odd entry cannot crowd out the rest. */
export const MAX_BREADCRUMB_LENGTH = 120;

const trail: string[] = [];

const timeOf = (date: Date) =>
	[date.getHours(), date.getMinutes(), date.getSeconds()].map(part => String(part).padStart(2, '0')).join(':');

export const addBreadcrumb = (entry: string, now: Date = new Date()) => {
	const line = `${timeOf(now)} ${entry}`.slice(0, MAX_BREADCRUMB_LENGTH);

	// The same step twice in a row says nothing new — a re-render reporting the screen it is on.
	if (trail.at(-1)?.slice(9) === line.slice(9)) {
		return;
	}

	trail.push(line);

	if (trail.length > MAX_BREADCRUMBS) {
		trail.splice(0, trail.length - MAX_BREADCRUMBS);
	}
};

/** The trail, oldest first — a copy, so a caller cannot change what is kept. */
export const readBreadcrumbs = (): string[] => [...trail];

/** For tests: start from nothing. */
export const clearBreadcrumbs = () => {
	trail.length = 0;
};

type RouteLike = { name: string; params?: object | undefined; state?: StateLike | undefined };
type StateLike = { index?: number | undefined; routes: readonly RouteLike[] };

/** The route params worth keeping: numbers only (a bab, a portion, a page), never ids or text. */
const numbersOf = (params: object | undefined) =>
	Object.entries(params ?? {})
		.filter((entry): entry is [string, number] => typeof entry[1] === 'number')
		.map(([key, value]) => `${key.replace(/Number$/u, '')} ${value}`);

/**
 * Where the user is, from the navigator's state: the focused route at each level, and at the
 * innermost the whole stack with the top screen's numbers — "Tabs › Groups [GroupsList,
 * GroupDetail, BabReader] (bab 97)". The stack is the point: what sits under a screen is what
 * the user lands on when something closes it.
 */
export const describeFocus = (state: StateLike | undefined): string => {
	const path: string[] = [];
	let current = state;

	while (current) {
		const route = current.routes[current.index ?? current.routes.length - 1];

		if (!route) {
			break;
		}

		if (!route.state) {
			const stack = current.routes.map(entry => entry.name).join(', ');
			const numbers = numbersOf(route.params);

			return `${[...path, `[${stack}]`].join(' › ')}${numbers.length > 0 ? ` (${numbers.join(', ')})` : ''}`;
		}

		path.push(route.name);
		current = route.state;
	}

	return path.join(' › ');
};
