import type { GroupBrowseState } from '@/lib/utils/groupBrowse';

export interface GroupBrowseBarProps {
	state: GroupBrowseState;
	/** The whole next state, so a screen can react to any part of it in one place. */
	onChange: (state: GroupBrowseState) => void;
}
