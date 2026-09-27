import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import type { GroupKind } from '@/lib/types/domain';

export interface GroupCardProps {
	/**
	 * What the group reads. Decides the type chip, and the denominator and unit word on the
	 * progress line — a hatim counts to thirty cüz, not a hundred babs.
	 */
	kind: GroupKind;
	name: string;
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
	/** Progress block — omitted on Discover cards, which show seats instead. */
	readCount?: number;
	percent?: number;
	/** The round-reset row, between the progress bar and the footer. Omitted while gathering. */
	resetRow?: ReactNode;
	/** Footer: label + caption on the left, an action on the right. */
	footerLabel?: string;
	/** The share's other slices or cüz, as a chip beside `footerLabel` — one slice plus a count. */
	footerMoreCount?: number;
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
