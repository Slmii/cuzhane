import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { ScreenTitle, SCREEN_TITLE_PADDING_TOP } from '@/components/ScreenTitle/ScreenTitle.component';
import {} from '@/components/ui/Typography/Typography.component';
import { StyleSheet, View } from 'react-native';
import type { ScreenHeaderProps } from './ScreenHeader.types';

/**
 * A pushed screen's header: back affordance over the shared `ScreenTitle` block, so the
 * heading keeps the same spacing as the tab roots rather than drifting on its own.
 */
export const ScreenHeader = ({
	action,
	eyebrow,
	onBack,
	style,
	subtitle,
	title,
	titleLines,
	titleTrailing
}: ScreenHeaderProps) => {
	return (
		<View style={style}>
			{onBack ? <BackLink onPress={onBack} style={styles.back} /> : null}
			<ScreenTitle
				// The eyebrow slot is normally left empty-but-reserved here, since the back
				// row already fills it. A screen that actually has one gets it laid out.
				hasReservedSecondaryLabel={false}
				label={title}
				{...(titleLines !== undefined ? { labelLines: titleLines } : {})}
				style={onBack ? styles.titleAfterBack : null}
				{...(eyebrow !== undefined ? { secondaryLabel: eyebrow } : {})}
				{...(subtitle !== undefined ? { description: subtitle } : {})}
				{...(titleTrailing !== undefined ? { trailing: titleTrailing } : {})}
				{...(action !== undefined ? { action } : {})}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	back: {
		alignSelf: 'flex-start',
		paddingBottom: 2,
		paddingTop: SCREEN_TITLE_PADDING_TOP
	},
	// The back row already supplies the top gap; this is the air under it, matching the
	// 12pt the create-group step header leaves below its own back link.
	titleAfterBack: {
		paddingTop: 10
	}
});
