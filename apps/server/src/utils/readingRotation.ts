import { civilDayNumber } from './rounds';

export type ReadingCadence = 'WEEKLY' | 'MONTHLY';

const requireParts = (parts: number) => {
	if (!Number.isSafeInteger(parts) || parts < 1) {
		throw new RangeError('Parts must be a positive integer');
	}
};

/** I=1 is coprime with every P, including P=1. Never use current membership order. */
export const assignedPart = (offset: number, step: number, parts: number): number => {
	requireParts(parts);
	return (((offset + step) % parts) + parts) % parts;
};

/** Least occupied, then farthest from existing readers, then lowest part index. */
export const chooseStartingPart = (parts: number, currentParts: number[]): number => {
	requireParts(parts);
	const counts = Array<number>(parts).fill(0);
	for (const part of currentParts) {
		counts[assignedPart(part, 0, parts)]!++;
	}
	let best = 0;
	let bestDistance = -1;
	const minimum = Math.min(...counts);
	for (let part = 0; part < parts; part++) {
		if (counts[part] !== minimum) {
			continue;
		}
		const distance =
			currentParts.length === 0
				? parts
				: Math.min(
						...currentParts.map(other => {
							const gap = Math.abs(part - other);
							return Math.min(gap, parts - gap);
						})
				  );
		if (distance > bestDistance) {
			best = part;
			bestDistance = distance;
		}
	}
	return best;
};

const wallDate = (instant: Date, timezone: string): Date => {
	const values = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(instant);
	const n = (type: string) => Number(values.find(value => value.type === type)!.value);
	return new Date(
		Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'), instant.getUTCMilliseconds())
	);
};

/** Calendar interval from the original anchor, retaining local time and clamping short months. */
export const cycleBoundary = (anchor: Date, cadence: ReadingCadence, index: number, timezone: string): Date => {
	if (index === 0) {
		return new Date(anchor);
	}
	const wall = wallDate(anchor, timezone);
	const target = new Date(wall);
	if (cadence === 'WEEKLY') {
		target.setUTCDate(wall.getUTCDate() + index * 7);
	} else {
		target.setUTCDate(1);
		target.setUTCMonth(wall.getUTCMonth() + index);
		const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
		target.setUTCDate(Math.min(wall.getUTCDate(), last));
	}
	let instant = target.getTime() + anchor.getTime() - wall.getTime();
	const seen = new Set<number>();
	for (let pass = 0; pass < 6; pass++) {
		const next = instant + target.getTime() - wallDate(new Date(instant), timezone).getTime();
		if (next === instant) {
			break;
		}
		// A nonexistent local time during spring-forward uses the later side of the gap.
		if (seen.has(next)) {
			instant = Math.max(instant, next);
			break;
		}
		seen.add(instant);
		instant = next;
	}
	return new Date(instant);
};

/** Group phase, independent of individual completion; P evenly spaced steps per interval. */
export const stepAt = (anchor: Date, cadence: ReadingCadence, parts: number, timezone: string, now: Date): number => {
	requireParts(parts);
	if (now <= anchor) {
		return 0;
	}
	const startWall = wallDate(anchor, timezone);
	const nowWall = wallDate(now, timezone);
	let cycle =
		cadence === 'WEEKLY'
			? Math.floor((civilDayNumber(now, timezone) - civilDayNumber(anchor, timezone)) / 7)
			: (nowWall.getUTCFullYear() - startWall.getUTCFullYear()) * 12 +
			  nowWall.getUTCMonth() -
			  startWall.getUTCMonth();
	while (cycle > 0 && cycleBoundary(anchor, cadence, cycle, timezone) > now) {
		cycle--;
	}
	while (cycleBoundary(anchor, cadence, cycle + 1, timezone) <= now) {
		cycle++;
	}
	const start = cycleBoundary(anchor, cadence, cycle, timezone).getTime();
	const end = cycleBoundary(anchor, cadence, cycle + 1, timezone).getTime();
	return cycle * parts + Math.min(parts - 1, Math.floor(((now.getTime() - start) * parts) / (end - start)));
};
