import type { GroupBrowseState } from '@/lib/utils/groupBrowse';

export interface GroupBrowseBarProps {
	state: GroupBrowseState;
	/** The whole next state, so a screen can react to any part of it in one place. */
	onChange: (state: GroupBrowseState) => void;
	/**
	 * Keep the filter and sort buttons beside the search field. On by default; Gruplarım turns
	 * it off because it carries both in the navigator's bar — see the component's own note.
	 */
	hasControls?: boolean;
}
