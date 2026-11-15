import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { MembersList } from './MembersList.component';
import type { MembersSheetProps } from './MembersSheet.types';

/**
 * Three quarters of the screen — **one** height, deliberately.
 *
 * A list of twenty members genuinely runs long, but most groups are five or six and a
 * full-height sheet opened onto a screen of empty space below them.
 *
 * A second, taller stop looks harmless and isn't: the sheet sizes its content to the *largest*
 * one, because that is the height it may be dragged to. At the smaller one the bottom of that
 * content sits below the screen, and a scroll view inside it ends there too — so the list
 * scrolled to its end with the last members still off-screen, unreachable by any gesture. One
 * height keeps the content and the visible sheet the same size.
 */
const SHEET_HEIGHT_RATIO = 0.75;

/**
 * Who is in the group — a sheet rather than a pushed screen, because it is something you
 * glance at and dismiss rather than a place you go. It opens over the group you are
 * already looking at, so the board stays behind it and closing costs no navigation. Yönet shows
 * the same list as a page of its own (`MembersList`).
 *
 * `snapPoints` alone now. `topInset` was the same measurement from the other end and the
 * platform sheet has no equivalent — but 75% already leaves the quarter-screen strip that inset
 * existed to keep, so saying it twice was the only thing lost.
 */
export const MembersSheet = ({ groupId, isVisible, onClose }: MembersSheetProps) => (
	<AppBottomSheet heightRatio={SHEET_HEIGHT_RATIO} isVisible={isVisible} onClose={onClose}>
		<MembersList groupId={groupId} isActive={isVisible} />
	</AppBottomSheet>
);
