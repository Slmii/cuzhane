import { MenuAction } from '@/components/ui/MenuAction/MenuAction.component';
import type { MenuActionItem } from '@/components/ui/MenuAction/MenuAction.types';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupCycle } from '@/lib/types/domain';
import {
	CYCLE_FILTER_OPTIONS,
	emptyGroupBrowseState,
	GROUP_SORT_OPTIONS,
	isGroupBrowseMenuActive,
	type GroupSortKey
} from '@/lib/utils/groupBrowse';
import { cycleLabelKey } from '@/lib/utils/groups';
import { useGroupBrowse } from './GroupBrowse.context';

/** The "all cadences" option has no cycle of its own, and a menu needs a value to tick. */
const ANY_CYCLE = 'any';

/**
 * Narrowing and ordering a list of groups, as one pull-down in the navigator's bar. It holds what
 * `GroupBrowseBar`'s two sheets hold — cadence, the two status filters, and the order — while the
 * **search box stays on the screen**, because a text field cannot live in a menu.
 *
 * That is what `GroupBrowseBar`'s `hasControls` is for: both screens that use this pass `false`
 * and keep only the search field. The controls are in one place per screen either way, which is
 * the rule that matters — two ways to the same filter would be worse than either.
 *
 * **One component for Gruplarım and Keşfet**, like the bar it replaces, and for the same reason:
 * the two screens ask the same questions of the same shape of data, and written twice they would
 * drift. It takes no props at all — the state comes from `useGroupBrowse`, and each tab stack
 * mounts its own provider, so the two screens narrow independently without this knowing which it
 * is serving.
 */
export const GroupBrowseMenu = () => {
	const { t } = useTranslation();
	const { browse, setBrowse } = useGroupBrowse();

	/*
	 * Two levels, not one flat list: narrowing and ordering are different questions, and the flat
	 * version ran cadence, status and order together as three unlabelled sections — you could
	 * read which option was ticked but not what it was answering.
	 *
	 * Filtering is a submenu because it holds two questions at once; ordering holds one, but is
	 * a submenu too so the top level reads as a pair rather than one row and a loose section.
	 */
	/*
	 * Each root row carries **what is currently chosen inside it** — "Filtrele · Günlük",
	 * "Sırala · Boş yeri çok" — so the menu answers at a glance what it used to make you open a
	 * level to read. The cadence names the filter; the two status toggles don't, because two
	 * booleans have no one word and "Günlük" already says the part worth saying.
	 */
	const cadenceLabel = browse.cycle ? t(cycleLabelKey(browse.cycle)) : t('allGroups');
	const sortLabel = t(GROUP_SORT_OPTIONS.find(option => option.key === browse.sortKey)?.labelKey ?? 'sortNewest');

	/*
	 * Two levels, not one flat list: narrowing and ordering are different questions, and the flat
	 * version ran cadence, status and order together as three unlabelled sections — you could
	 * read which option was ticked but not what it was answering.
	 *
	 * Filtering is a submenu because it holds two questions at once — the cadence as a choice
	 * under its own heading, and the status toggles under a `section` of theirs — so the level
	 * says which question each row answers. Ordering holds one, but is a submenu too so the top
	 * level reads as a pair rather than one row and a loose section.
	 */
	const items: MenuActionItem[] = [
		{
			assetName: 'filtre-filter',
			icon: 'filter',
			items: [
				{
					kind: 'choice',
					label: t('filterCadence'),
					onChange: value =>
						setBrowse({ ...browse, cycle: value === ANY_CYCLE ? undefined : (value as GroupCycle) }),
					options: CYCLE_FILTER_OPTIONS.map(option => ({
						label: option ? t(cycleLabelKey(option)) : t('allGroups'),
						value: option ?? ANY_CYCLE
					})),
					value: browse.cycle ?? ANY_CYCLE,
					icon: 'calendar'
				},
				{ kind: 'section', label: t('filterStatus') },
				{
					icon: 'clock',
					isOn: browse.isNotStartedOnly,
					kind: 'toggle',
					label: t('fNotStarted'),
					onChange: isNotStartedOnly => setBrowse({ ...browse, isNotStartedOnly })
				},
				{
					icon: 'members',
					isOn: browse.hasSeatsOnly,
					kind: 'toggle',
					label: t('fSeats'),
					onChange: hasSeatsOnly => setBrowse({ ...browse, hasSeatsOnly })
				}
			],
			kind: 'submenu',
			label: t('filterTitle'),
			value: cadenceLabel
		},
		{
			assetName: 'sirala-sort',
			icon: 'sort',
			items: [
				{
					icon: 'sort',
					kind: 'choice',
					label: t('sortTitle'),
					onChange: value => setBrowse({ ...browse, sortKey: value as GroupSortKey }),
					options: GROUP_SORT_OPTIONS.map(option => ({ label: t(option.labelKey), value: option.key })),
					value: browse.sortKey
				}
			],
			kind: 'submenu',
			label: t('sortTitle'),
			value: sortLabel
		}
	];

	// Offered only when there is something to clear — which includes a changed sort order, since
	// the clear resets that too. It keeps the search box's contents; see the predicate. Red,
	// because it undoes every answer above it at once.
	if (isGroupBrowseMenuActive(browse)) {
		items.push({
			icon: 'close',
			label: t('filterClear'),
			onPress: () => setBrowse({ ...emptyGroupBrowseState, search: browse.search }),
			tone: 'destructive'
		});
	}

	return (
		<MenuAction
			accessibilityLabel={t('filterTitle')}
			assetName='filtre-filter'
			icon='filter'
			items={items}
			tone='surface'
		/>
	);
};
