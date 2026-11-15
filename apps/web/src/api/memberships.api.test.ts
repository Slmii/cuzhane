import { describe, expect, it, vi } from 'vitest';
import { previewGroupByCode, previewGroupById } from './memberships.api';
import { wrapperApi } from './wrapper.api';

vi.mock('./wrapper.api', () => ({ wrapperApi: vi.fn() }));

const preview = {
	id: 'group-1',
	name: 'Reading group',
	memberCount: 3,
	poolBabNumbers: [61, 62],
	nextRange: { start: 41, end: 60 }
};

describe.each([
	['group', () => previewGroupById('group-1'), '/memberships/preview/group/group-1'],
	['code', () => previewGroupByCode('ABCD1234'), '/memberships/preview/code/ABCD1234']
] as const)('preview by %s', (_name, load, endpoint) => {
	it.each([undefined, null])('opens a preview when member names are %s', async memberNames => {
		// The deployed preview API omits memberNames. JSON drops undefined fields.
		vi.mocked(wrapperApi).mockResolvedValue(JSON.parse(JSON.stringify({ ...preview, memberNames })));

		const result = await load();

		expect(wrapperApi).toHaveBeenCalledWith(endpoint, { method: 'GET' });
		expect(result.memberNames).toEqual([]);
		// These are the operations the invitation screen performs while rendering.
		expect(result.memberCount - result.memberNames.length).toBe(3);
		expect(result.memberNames.join(', ')).toBe('');
		expect(result.poolBabNumbers).toEqual(preview.poolBabNumbers);
		expect(result.nextRange).toEqual(preview.nextRange);
	});

	it.each([{ memberNames: [] }, { memberNames: ['Ali', 'Emre'] }])(
		'never keeps server names — a preview names nobody: $memberNames',
		async ({ memberNames }) => {
			const response = { ...preview, memberNames };
			vi.mocked(wrapperApi).mockResolvedValue(response);

			expect(await load()).toEqual({ ...preview, memberNames: [] });
		}
	);

	it('keeps failed previews as errors', async () => {
		const error = new Error('Group not found');
		vi.mocked(wrapperApi).mockRejectedValue(error);

		await expect(load()).rejects.toBe(error);
	});
});
