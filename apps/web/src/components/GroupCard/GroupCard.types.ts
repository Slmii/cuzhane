import type { GroupProgressSummaryProps } from '@/components/GroupProgressSummary/GroupProgressSummary.types';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';

export interface GroupCardProps {
	name: string;
	/**
	 * A mark before the name — the Hizb's star, so a Hizb group and a Cevşen group can be told
	 * apart in a list without reading either. Absent on a Cevşen card, which draws as it always has.
	 */
	titleLeading?: ReactNode;
	subtitle?: string;
	badgeLabel: string;
	badgeTone?: ChipTone;
	/** Glyph before the badge's label — the visibility globe or padlock. */
	badgeIcon?: IconName;
	/**
	 * Further chips stacked under the badge, right-aligned — the design's status chip and
	 * ghost "Kurucu" tag. Empty on most cards.
	 */
	extraBadges?: { label: string; tone?: ChipTone }[];
	onPress?: () => void;
	/**
	 * Progress block — omitted on Discover cards, which show seats instead. One object, so a
	 * count can't arrive without the total and the noun it is read against.
	 */
	progress?: Omit<GroupProgressSummaryProps, 'style'>;
	/** The round-reset row, between the progress bar and the footer. Omitted while gathering. */
	resetRow?: ReactNode;
	/** Footer: label + caption on the left, an action on the right. */
	footerLabel?: string;
	footerCaption?: string;
	footerLeading?: ReactNode;
	actionLabel?: string;
	/**
	 * Omit to render the action as a static pill. Keşfet does this: the row is a link into
	 * the preview and joining happens there, so the label describes what you'll find rather
	 * than offering a second, competing tap target.
	 */
	onAction?: () => void;
	isActionDisabled?: boolean;
	isActionPrimary?: boolean;
	style?: StyleProp<ViewStyle>;
}
