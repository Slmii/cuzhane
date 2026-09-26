import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet } from 'react-native';

/** A missed deadline is information: catching up stays available. */
export const LateReadingNotice = ({ daysLate }: { daysLate: number }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	if (!Number.isFinite(daysLate) || daysLate < 1) {
		return null;
	}

	return (
		<CaptionText color={theme.colors.subtext} style={styles.notice}>
			{t(daysLate === 1 ? 'lateReadingNoticeOne' : 'lateReadingNoticeMany', { days: daysLate })}
		</CaptionText>
	);
};

const styles = StyleSheet.create({
	notice: {
		marginBottom: 12
	}
});
