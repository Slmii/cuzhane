import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TOUR_STOPS } from './tourSteps';

type TourWelcomeSheetProps = {
	onDismiss: () => void;
	/** Called once this sheet is fully gone — never while it is still on screen. */
	onStart: () => void;
};

/**
 * O1 — the card that offers the tour before it starts.
 *
 * **A sheet, because the design draws one and because everything modal here is one.** The frame
 * is a panel pinned to the bottom edge with a grabber above it; that is `AppBottomSheet`, and
 * the repo's rule is that every modal surface goes through it so they all share one spring,
 * scrim and drag-to-dismiss. The design's own 26pt radius and `#F7F5F0` fill are not
 * reproduced by hand for the same reason the rest of the app doesn't: the surface, the corner
 * and the grabber belong to the OS.
 *
 * Dismissing it — the grabber, a drag, the backdrop, or "Şimdi değil" — counts as having seen
 * the tour. Someone who declines it should not be asked again on every launch; Profil keeps a
 * way back in, which is exactly what `tourDoneSub` promises.
 *
 * **"Tura başla" closes this sheet and only then starts the tour**, which is why the sheet holds
 * its own presented flag instead of being driven by the step. The first stop is a `Modal`, and
 * iOS will not present one over a sheet that is still on screen — asking it to did nothing at
 * all: the sheet slid away and the spotlight never arrived, so the tour looked like a button
 * that does nothing. `AppBottomSheet` reports `onDismissed` when the transition *ends*, so that
 * callback is the moment the screen is free. A ref decides which of the two things it means,
 * because a drag and a tap on "Tura başla" both arrive there.
 */
export const TourWelcomeSheet = ({ onDismiss, onStart }: TourWelcomeSheetProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [isPresented, setIsPresented] = useState(true);
	const isStarting = useRef(false);

	const handleDismissed = () => {
		if (isStarting.current) {
			onStart();
			return;
		}

		onDismiss();
	};

	const handleStart = () => {
		isStarting.current = true;
		setIsPresented(false);
	};

	return (
		<AppBottomSheet isVisible={isPresented} onDismissed={handleDismissed}>
			<View style={styles.head}>
				<View style={[styles.mark, { backgroundColor: theme.colors.accent }]}>
					<BrandMark
						color={theme.colors.onHeaderSurface}
						fadedColor={toAlphaColor(theme.colors.onHeaderSurface, 0.55)}
						size={30}
					/>
				</View>
				<View style={styles.headCopy}>
					<Typography variant='header2'>{t('tourWelcomeTitle')}</Typography>
					<Typography color={toAlphaColor(theme.colors.text, 0.55)} style={styles.sub} variant='caption'>
						{t('tourWelcomeSub')}
					</Typography>
				</View>
			</View>

			{/* The three stops, numbered — the design's own preview of where the tour goes. */}
			<View style={styles.stops}>
				{TOUR_STOPS.map((stopKey, index) => (
					<View
						key={stopKey}
						style={[
							styles.stop,
							{ backgroundColor: theme.colors.card, borderColor: toAlphaColor(theme.colors.text, 0.08) }
						]}
					>
						<View style={[styles.stopNumber, { backgroundColor: theme.colors.accentSoft }]}>
							<Typography color={theme.colors.accent} variant='caption' weight='semibold'>
								{String(index + 1)}
							</Typography>
						</View>
						<Typography style={styles.stopLabel} variant='caption' weight='medium'>
							{t(stopKey)}
						</Typography>
					</View>
				))}
			</View>

			<View style={styles.actions}>
				<AppButton onPress={handleStart} size='lg' title={t('tourStart')} />
				<Pressable accessibilityRole='button' onPress={() => setIsPresented(false)} style={styles.later}>
					<Typography color={toAlphaColor(theme.colors.text, 0.55)} variant='caption' weight='semibold'>
						{t('tourLater')}
					</Typography>
				</Pressable>
			</View>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	actions: {
		gap: 8
	},
	head: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 14,
		marginBottom: 16
	},
	headCopy: {
		flex: 1,
		minWidth: 0
	},
	later: {
		alignItems: 'center',
		paddingVertical: 6
	},
	mark: {
		alignItems: 'center',
		borderRadius: 16,
		height: 52,
		justifyContent: 'center',
		width: 52
	},
	stop: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: 'row',
		gap: 11,
		paddingHorizontal: 12,
		paddingVertical: 10
	},
	stopLabel: {
		flex: 1
	},
	stopNumber: {
		alignItems: 'center',
		borderRadius: 7,
		height: 22,
		justifyContent: 'center',
		width: 22
	},
	stops: {
		gap: 7,
		marginBottom: 18
	},
	sub: {
		marginTop: 7
	}
});
