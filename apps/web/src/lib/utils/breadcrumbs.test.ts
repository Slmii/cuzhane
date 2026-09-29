import { beforeEach, describe, expect, it } from 'vitest';
import {
	MAX_BREADCRUMB_LENGTH,
	MAX_BREADCRUMBS,
	addBreadcrumb,
	clearBreadcrumbs,
	describeFocus,
	readBreadcrumbs
} from './breadcrumbs';

const at = (seconds: number) => new Date(2026, 8, 28, 22, 41, seconds);

beforeEach(() => clearBreadcrumbs());

describe('breadcrumbs', () => {
	it('keeps the newest thirty, oldest first', () => {
		for (let i = 0; i < MAX_BREADCRUMBS + 5; i++) {
			addBreadcrumb(`step ${i}`, at(i % 60));
		}

		const trail = readBreadcrumbs();
		expect(trail).toHaveLength(MAX_BREADCRUMBS);
		expect(trail[0]).toBe('22:41:05 step 5');
		expect(trail.at(-1)).toBe('22:41:34 step 34');
	});

	it('drops a step repeated straight after itself, and cuts a long one', () => {
		addBreadcrumb('app active', at(1));
		addBreadcrumb('app active', at(2));
		addBreadcrumb('x'.repeat(500), at(3));

		expect(readBreadcrumbs()).toHaveLength(2);
		expect(readBreadcrumbs()[1]).toHaveLength(MAX_BREADCRUMB_LENGTH);
	});

	it('hands out a copy', () => {
		addBreadcrumb('app active', at(1));
		readBreadcrumbs().push('tampered');

		expect(readBreadcrumbs()).toEqual(['22:41:01 app active']);
	});
});

describe('describeFocus', () => {
	it('names the focused route at each level, the innermost with its numbers only', () => {
		const state = {
			index: 0,
			routes: [
				{
					name: 'Tabs',
					state: {
						index: 1,
						routes: [
							{ name: 'Home' },
							{
								name: 'Groups',
								state: {
									index: 2,
									routes: [
										{ name: 'GroupsList' },
										{ name: 'GroupDetail', params: { groupId: 'abc' } },
										{ name: 'BabReader', params: { babNumber: 97, groupId: 'abc' } }
									]
								}
							}
						]
					}
				}
			]
		};

		// The whole stack under the reader, and the group's id stays out: numbers only.
		expect(describeFocus(state)).toBe('Tabs › Groups › [GroupsList, GroupDetail, BabReader] (bab 97)');
	});

	it('says nothing more than the names when there are no numbers', () => {
		expect(describeFocus({ routes: [{ name: 'Onboarding' }] })).toBe('[Onboarding]');
	});
});
