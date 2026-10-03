import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { StartedProgressProps } from './StartedProgress.types';

/**
 * The width of the line's label, so every bar under it — the Hizb's counters too — starts on the
 * same line as the page's.
 */
export const STARTED_LABEL_WIDTH = 74;

/**
 * "Başladı": a reading begun and not yet read — its tag, and how far along with a bar. One look
 * for every kind's reading, plan or group.
 */
export const StartedProgress = ({ children, label, percent, style }: StartedProgressProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={[styles.box, { backgroundColor: theme.colors.background }, style]}>
			{/* On its own line above the rows, so it heads them all rather than the page. */}
			<View style={[styles.tag, { backgroundColor: theme.colors.sand }]}>
				<Typography color={theme.colors.sandText} style={styles.tagLabel} variant='stat' weight='semibold'>
					{t('hpStarted')}
				</Typography>
			</View>
			<View style={styles.line}>
				<CaptionText color={theme.colors.subtext} style={styles.label} weight='semibold'>
					{label}
				</CaptionText>
				<View style={[styles.bar, { backgroundColor: theme.colors.progressTrack }]}>
					<View
						style={[
							styles.barFill,
							{ backgroundColor: theme.colors.accent, width: `${Math.min(100, Math.max(0, percent))}%` }
						]}
					/>
				</View>
			</View>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	box: { borderRadius: 12, gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
	tag: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
	tagLabel: { fontSize: 9.5, letterSpacing: 0.57 },
	line: { alignItems: 'center', flexDirection: 'row', gap: 8 },
	label: { fontSize: 11, width: STARTED_LABEL_WIDTH },
	bar: { borderRadius: 2, flex: 1, height: 4, overflow: 'hidden' },
	barFill: { height: '100%' }
});
