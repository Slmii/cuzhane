import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

type TourEndSheetProps = {
	isVisible: boolean;
	/** Called once the sheet is fully gone — never while it is still on screen. */
	onEnd: () => void;
	onKeepGoing: () => void;
};

/**
 * TX — "Turu bitirelim mi?", from "Turu geç" on any stop and from T1's "Şimdi değil".
 *
 * **A sheet, because the design draws one and because everything modal here is one**, so it
 * shares the platform's spring, scrim and drag-to-dismiss with every other sheet. A drag or a tap
 * on the backdrop is "Tura devam et": dismissing a question is not answering yes to it.
 *
 * **"Turu bitir" closes the sheet and only then ends the tour.** Ending unwinds the tour's screens
 * back to Ana sayfa, and a navigation dispatched while an OS sheet is still leaving raced the
 * sheet before (the old welcome sheet recorded it). `onDismissed` fires when the transition *ends*,
 * so that is the moment the screen is free; a ref says which of the two things it means.
 */
export const TourEndSheet = ({ isVisible, onEnd, onKeepGoing }: TourEndSheetProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isEnding = useRef(false);

	const handleDismissed = () => {
		if (isEnding.current) {
			isEnding.current = false;
			onEnd();
		}
	};

	const handleEnd = () => {
		isEnding.current = true;
		onKeepGoing();
	};

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onKeepGoing} onDismissed={handleDismissed}>
			<View>
				<Typography style={styles.title} variant='header2'>
					{t('tourEndTitle')}
				</Typography>
				<Typography color={toAlphaColor(theme.colors.text, 0.6)} style={styles.sub} variant='caption'>
					{t('tourEndSub')}
				</Typography>
				<View style={styles.actions}>
					<AppButton onPress={handleEnd} size='lg' title={t('tourEndYes')} variant='primary' />
					<AppButton onPress={onKeepGoing} size='lg' title={t('tourEndNo')} variant='surface' />
				</View>
			</View>
		</AppBottomSheet>
	);
};

/* The design's measures, one to one (section T, TX). */
const styles = StyleSheet.create({
	actions: {
		gap: 8,
		marginTop: 20
	},
	sub: {
		fontSize: 13,
		lineHeight: 20,
		marginTop: 7
	},
	title: {
		fontSize: 22,
		lineHeight: 26.4
	}
});
