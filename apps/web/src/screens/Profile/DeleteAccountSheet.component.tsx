import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, Header2 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet } from 'react-native';

type Props = {
	isDeleting: boolean;
	isVisible: boolean;
	onClose: () => void;
	onConfirm: () => void;
};

export const DeleteAccountSheet = ({ isDeleting, isVisible, onClose, onConfirm }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose}>
			<Header2 style={styles.title}>{t('deleteAccount')}</Header2>
			<CaptionText color={theme.colors.subtext} style={styles.hint}>
				{t('deleteAccountHint')}
			</CaptionText>
			<AppButton
				disabled={isDeleting}
				isLoading={isDeleting}
				onPress={onConfirm}
				style={styles.confirmButton}
				title={t('deleteAccountConfirm')}
				variant='danger'
			/>
			<AppButton disabled={isDeleting} onPress={onClose} title={t('cancel')} variant='surface' />
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	confirmButton: {
		marginBottom: 9
	},
	hint: {
		marginBottom: 18,
		marginTop: 8
	},
	title: {
		fontSize: 21
	}
});
