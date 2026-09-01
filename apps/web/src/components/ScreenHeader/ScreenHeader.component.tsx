import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { View } from 'react-native';
import type { ScreenHeaderProps } from './ScreenHeader.types';

/**
 * A pushed screen's header: the shared `ScreenTitle` block, under whatever the navigator draws
 * above it, so the heading keeps the same spacing as the tab roots rather than drifting.
 *
 * **The back control is the platform's, not ours.** These screens are registered with a
 * transparent native header, so iOS and Android each draw their own — correct on every platform
 * for free, and Liquid Glass on iOS 26 without asking.
 *
 * **The title goes under it, not beside it.** `hasBackButton` reserves a navigation bar's height
 * so the heading starts below the control. Sitting the two side by side was tried — it saves the
 * 44pt — but it indents the title away from the left edge every card below it lines up on, and
 * the heading stopped reading as the start of the page.
 *
 * There is no drawn alternative any more. `ui/BackLink` — a "‹ Geri" link — was kept for screens
 * whose back had to say *where* it went, but every one of them now takes the platform's control:
 * the invite preview and the joined welcome are pushed screens, and create-group is a sheet, so
 * it uses `AppButton`'s glyph-only form, which is the same glass control.
 */
export const ScreenHeader = ({
	action,
	eyebrow,
	hasBackButton = false,
	style,
	subtitle,
	title,
	titleLines,
	titleTrailing
}: ScreenHeaderProps) => {
	return (
		<View style={style}>
			<ScreenTitle
				// The eyebrow slot is normally left empty-but-reserved here, since the band
				// above already fills it. A screen that actually has one gets it laid out.
				hasReservedSecondaryLabel={false}
				isUnderNavigationBar={hasBackButton}
				label={title}
				{...(titleLines !== undefined ? { labelLines: titleLines } : {})}
				{...(eyebrow !== undefined ? { secondaryLabel: eyebrow } : {})}
				{...(subtitle !== undefined ? { description: subtitle } : {})}
				{...(titleTrailing !== undefined ? { trailing: titleTrailing } : {})}
				{...(action !== undefined ? { action } : {})}
			/>
		</View>
	);
};
