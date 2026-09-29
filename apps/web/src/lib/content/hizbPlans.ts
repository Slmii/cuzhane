import { startsFor, type PlanAnchor } from '../utils/hizbPlans';
import { sliceHizbBlocks } from './hizbPortions';

const anchor = ([section, block, line, invocation]: PlanAnchor) => ({ section, block, line, invocation });
export const planBlocks = (days: number, portion: number) => {
	const starts = startsFor(days);
	const from = starts[portion - 1];
	if (!from) {throw new RangeError('Unknown Hizb portion');}
	const until = starts[portion];
	return sliceHizbBlocks(anchor(from), until ? anchor(until) : undefined);
};
