import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { PasswordStrengthProps } from './PasswordStrength.types';

const BAR_COUNT = 3;
const MIN_LENGTH = 8;
const COMFORTABLE_LENGTH = 12;

/** 0 = too short to score, 1..3 = weak / medium / strong. */
const scorePassword = (password: string) => {
	if (password.length < MIN_LENGTH) {
		return password.length === 0 ? 0 : 1;
	}

	// The copy on the screen promises "at least 8 characters, including a number",
	// so length and a digit are the two things actually being asked for.
	const hasDigit = /\d/.test(password);
	const hasVariety = /[^a-z0-9]/i.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password));

	if (hasDigit && (hasVariety || password.length >= COMFORTABLE_LENGTH)) {
		return 3;
	}

	return hasDigit ? 2 : 1;
};

export const PasswordStrength = ({ password, style }: PasswordStrengthProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const score = scorePassword(password);

	if (score === 0) {
		return null;
	}

	const label = score === 3 ? t('pwStrong') : score === 2 ? t('pwMedium') : t('pwWeak');
	const fillColor = score === 3 ? theme.colors.accent : score === 2 ? theme.colors.accentMid : theme.colors.danger;

	return (
		<View style={[styles.container, style]}>
			{Array.from({ length: BAR_COUNT }, (_, index) => (
				<View
					key={index}
					style={[styles.bar, { backgroundColor: index < score ? fillColor : theme.colors.track }]}
				/>
			))}
			<Typography color={fillColor} style={styles.label} variant='caption' weight='semibold'>
				{label}
			</Typography>
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		borderRadius: 2,
		flex: 1,
		height: 3
	},
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	label: {
		fontSize: 10.5
	}
});
