import { emptyGroupBrowseState, type GroupBrowseState } from '@/lib/utils/groupBrowse';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * How a list of groups is narrowed and ordered, held above a tab's navigator so that the screen
 * and its **navigator-owned toolbar** are looking at one state.
 *
 * A context rather than the route params the other toolbars use: `shouldOpenJoinSheet` and
 * `GroupDetail.sheet` are one-shot requests that get cleared, but this is five fields including
 * free text that change as you type. Params are addressable — they belong in a deep link — and a
 * half-typed search string does not.
 *
 * **Mounted per tab stack, not once for the app**, in `AppNavigator` — around Gruplarım's and
 * around Keşfet's. That is what puts each screen and its header inside one provider, and it is
 * also what keeps the two apart: the same component narrows both, but a cadence chosen while
 * browsing the catalogue must not follow you back to your own shelf. Two instances of one
 * context, rather than one instance the two screens would have to partition by hand.
 */
interface GroupBrowseContextValue {
	browse: GroupBrowseState;
	setBrowse: (state: GroupBrowseState) => void;
}

const GroupBrowseContext = createContext<GroupBrowseContextValue | null>(null);

export const GroupBrowseProvider = ({ children }: { children: ReactNode }) => {
	const [browse, setBrowse] = useState<GroupBrowseState>(emptyGroupBrowseState);
	const value = useMemo(() => ({ browse, setBrowse }), [browse]);

	return <GroupBrowseContext.Provider value={value}>{children}</GroupBrowseContext.Provider>;
};

export const useGroupBrowse = () => {
	const value = useContext(GroupBrowseContext);

	if (!value) {
		throw new Error('useGroupBrowse must be used inside a GroupBrowseProvider');
	}

	return value;
};
