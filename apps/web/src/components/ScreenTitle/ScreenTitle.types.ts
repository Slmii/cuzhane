import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ScreenTitleProps {
	label: string;
	/** Eyebrow above the label — Home's "Bugün", the Groups greeting. */
	secondaryLabel?: string;
	/** Caption below the label — Profile's "member since". */
	description?: string;
	/** Sits left of the text block. Profile puts its avatar here. */
	leading?: ReactNode;
	/** Sits right of the text block. Home puts its "Genel bakış" button here. */
	action?: ReactNode;
	/**
	 * Sits inline beside the label, hugging it — the group screen's cycle chip. Distinct
	 * from `action`, which is pushed to the far edge of the row.
	 */
	trailing?: ReactNode;
	/**
	 * The three label scales the design uses: `page` for a screen heading, `name` for
	 * a person's name beside their avatar, `compact` for Home's group name — which is
	 * a subtitle to its eyebrow rather than a heading.
	 */
	size?: 'page' | 'name' | 'compact';
	/**
	 * Keep the eyebrow's row even when there is no `secondaryLabel`, so the label lands
	 * on the same baseline as screens that do have one. On by default — that is what
	 * stops the title jumping as you move between tabs. `ScreenHeader` turns it off,
	 * since its back row already sits in that slot.
	 */
	hasReservedSecondaryLabel?: boolean;
	style?: StyleProp<ViewStyle>;
}
