import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BodyText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { RepetitionCounter } from '@/components/RepetitionCounter/RepetitionCounter.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { DelailProgress } from './HizbBody.types';

export const DelailReading = ({ children, progress }: { children: ReactNode; progress?: DelailProgress }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	return (
		<View style={styles.section}>
			<BodyText>{t('hpDelailGuide')}</BodyText>
			<View
				style={[
					styles.highlight,
					{ backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent }
				]}
			>
				{children}
			</View>
			{progress ? (
				<RepetitionCounter
					count={progress.count}
					required={3}
					isDisabled={progress.disabled}
					onChange={progress.onChange}
				/>
			) : null}
			{progress?.sessionOnly ? (
				<CaptionText color={theme.colors.subtext}>{t('hpIstighfarSession')}</CaptionText>
			) : null}
		</View>
	);
};
const styles = StyleSheet.create({
	section: { gap: 12, marginBottom: 22 },
	highlight: { borderWidth: 1, borderRadius: 14, padding: 16 }
});
