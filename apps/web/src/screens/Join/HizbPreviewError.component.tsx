import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

type Props = {
	/** The server doesn't know the group or the code any more — deleted, or the code changed. */
	isInvalid: boolean;
	onBackToDiscover: () => void;
	onEnterAnotherCode: () => void;
	onRetry: () => void;
};

/**
 * P8 — a Hizb invite preview that didn't load: "couldn't load" (retry) or "this invite is no longer
 * valid" (a deleted group and a changed code land on the same words; the reason isn't told apart).
 */
export const HizbPreviewError = ({ isInvalid, onBackToDiscover, onEnterAnotherCode, onRetry }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer contentContainerStyle={styles.content}>
			<ScreenHeader hasBackButton title=' ' />
			<View style={styles.center}>
				<View style={[styles.badge, { backgroundColor: theme.colors.segmentTrack }]}>
					<Icon
						color={theme.colors.faintText}
						name={isInvalid ? 'alertCircle' : 'offline'}
						size={24}
						strokeWidth={1.7}
					/>
				</View>
				<Typography style={styles.title} textAlign='center' variant='title'>
					{t(isInvalid ? 'hdInviteInvalid' : 'hdLoadFailed')}
				</Typography>
				<CaptionText color={theme.colors.subtext} style={styles.body} textAlign='center'>
					{t(isInvalid ? 'hdInviteInvalidBody' : 'hdLoadFailedBody')}
				</CaptionText>
			</View>
			<View style={styles.actions}>
				{isInvalid ? (
					<>
						<AppButton onPress={onBackToDiscover} title={t('hdBackToDiscover')} variant='primary' />
						<AppButton onPress={onEnterAnotherCode} title={t('hdEnterAnotherCode')} variant='surface' />
					</>
				) : (
					<>
						<AppButton onPress={onRetry} title={t('retry')} variant='primary' />
						<AppButton onPress={onBackToDiscover} title={t('hdBackToDiscover')} variant='surface' />
					</>
				)}
			</View>
		</ScreenContainer>
	);
};

/* Section 5's P8. */
const styles = StyleSheet.create({
	content: { flexGrow: 1 },
	center: {
		alignItems: 'center',
		flex: 1,
		gap: 7,
		justifyContent: 'center',
		paddingBottom: 40,
		paddingHorizontal: 14
	},
	badge: { alignItems: 'center', borderRadius: 18, height: 56, justifyContent: 'center', marginBottom: 8, width: 56 },
	title: { fontSize: 21, lineHeight: 26.25 },
	body: { fontSize: 12.5, lineHeight: 19.4, maxWidth: 270 },
	actions: { gap: 9 }
});
