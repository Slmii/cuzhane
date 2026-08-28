import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { AppTheme } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { SliceChipProps } from './SliceChip.types';

/**
 * "+2 aralık daha" — the rest of a share, counted rather than spelled out (design 01g).
 *
 * A share used to be one stretch and is now often several: volunteering for a pool block
 * hands you a second, unconnected range. Written out in full they run to "1–13, 27–39,
 * 66–78", which wrapped the ring's range onto three lines and doubled the height of the
 * group screen's heading — while still not answering the only question the line is there
 * for, which is what to read next. So one slice is shown at full size and this says how
 * many others are waiting behind it.
 *
 * It renders nothing at all for a single-range share, which is the ordinary case.
 */
const BACKGROUND_BY_TONE: Record<NonNullable<SliceChipProps['tone']>, (theme: AppTheme) => string> = {
	soft: theme => theme.colors.accentSoft,
	surface: theme => theme.colors.surface,
	wash: theme => theme.colors.sliceChip
};

export const SliceChip = ({ count, isCompact = false, style, tone = 'soft' }: SliceChipProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	if (count < 1) {
		return null;
	}

	return (
		<View
			style={[
				styles.chip,
				isCompact ? styles.compact : null,
				{ backgroundColor: BACKGROUND_BY_TONE[tone](theme) },
				style
			]}
		>
			{/* Mono, like every other counted thing in the design — and one line always: the
			    chip sits beside a range that must not be pushed around by it. */}
			<Typography color={theme.colors.accent} numberOfLines={1} style={styles.label} variant='mono'>
				{isCompact ? `+${count}` : `+${count} ${t('multiCollapsed')}`}
			</Typography>
		</View>
	);
};

const styles = StyleSheet.create({
	chip: {
		borderRadius: 6,
		paddingHorizontal: 7,
		paddingVertical: 4
	},
	compact: {
		paddingHorizontal: 5,
		paddingVertical: 2
	},
	label: {
		fontSize: 10,
		lineHeight: 13
	}
});
