import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TourChoice } from './tourSteps';

type TourPickSheetProps = {
	isVisible: boolean;
	onClose: () => void;
	/** Called once the sheet is fully gone — never while it is still on screen. */
	onStart: (choice: TourChoice) => void;
};

/** The four ways to run it, in the design's order; only "Hepsi" says what it covers. */
const CHOICES: readonly { choice: TourChoice; labelKey: StringKey; subKey?: StringKey }[] = [
	{ choice: 'all', labelKey: 'tourPickAll', subKey: 'tourPickAllSub' },
	{ choice: 'cevsen', labelKey: 'kindCevsen' },
	{ choice: 'quran', labelKey: 'tourLegQuran' },
	{ choice: 'hizb', labelKey: 'kindHizb' }
];

/**
 * TP — Profil › Uygulama turu: what to show. "Hepsi" is the whole tour from T1; one kind runs that
 * kind's part alone, for someone who has just started reading it.
 *
 * **"Turu başlat" closes the sheet and only then starts the tour**, for the reason `TourEndSheet`
 * records: the tour's first move is a navigation, and one dispatched while an OS sheet is still
 * leaving raced it. `onDismissed` is the moment the screen is free; a ref says whether the
 * dismissal was a start or a plain close.
 */
export const TourPickSheet = ({ isVisible, onClose, onStart }: TourPickSheetProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [choice, setChoice] = useState<TourChoice>('all');
	const startWith = useRef<TourChoice | null>(null);

	const handleDismissed = () => {
		const chosen = startWith.current;

		startWith.current = null;

		if (chosen !== null) {
			onStart(chosen);
		}
	};

	const handleStart = () => {
		startWith.current = choice;
		onClose();
	};

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose} onDismissed={handleDismissed}>
			<View>
				<Typography style={styles.title} variant='header2'>
					{t('tourPickTitle')}
				</Typography>
				<Typography color={toAlphaColor(theme.colors.text, 0.6)} style={styles.sub} variant='caption'>
					{t('tourPickSub')}
				</Typography>
				<View accessibilityRole='radiogroup' style={styles.options}>
					{CHOICES.map(option => {
						const isChosen = option.choice === choice;

						return (
							<Pressable
								accessibilityRole='radio'
								accessibilityState={{ checked: isChosen }}
								key={option.choice}
								onPress={() => setChoice(option.choice)}
								style={[
									styles.option,
									{
										backgroundColor: isChosen ? theme.colors.accentSoft : theme.colors.card,
										borderColor: isChosen
											? theme.colors.accent
											: toAlphaColor(theme.colors.text, 0.12)
									}
								]}
							>
								<View style={styles.optionCopy}>
									<Typography style={styles.optionLabel} variant='title'>
										{t(option.labelKey)}
									</Typography>
									{option.subKey ? (
										<CaptionText
											color={toAlphaColor(theme.colors.text, 0.55)}
											style={styles.optionSub}
										>
											{t(option.subKey)}
										</CaptionText>
									) : null}
								</View>
								<View
									style={[
										styles.radio,
										{
											borderColor: isChosen
												? theme.colors.accent
												: toAlphaColor(theme.colors.text, 0.25)
										}
									]}
								>
									{isChosen ? (
										<View style={[styles.radioDot, { backgroundColor: theme.colors.accent }]} />
									) : null}
								</View>
							</Pressable>
						);
					})}
				</View>
				<View style={styles.start}>
					<AppButton onPress={handleStart} size='lg' title={t('tourRun')} variant='primary' />
				</View>
			</View>
		</AppBottomSheet>
	);
};

/* The design's measures, one to one (section T, TP). */
const styles = StyleSheet.create({
	option: {
		alignItems: 'center',
		borderRadius: 16,
		borderWidth: 1.5,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	optionCopy: {
		flex: 1,
		minWidth: 0
	},
	optionLabel: {
		fontSize: 16,
		lineHeight: 20
	},
	optionSub: {
		fontSize: 11,
		lineHeight: 15,
		marginTop: 2
	},
	options: {
		gap: 8,
		marginTop: 16
	},
	radio: {
		alignItems: 'center',
		borderRadius: 10,
		borderWidth: 1.5,
		height: 20,
		justifyContent: 'center',
		width: 20
	},
	radioDot: {
		borderRadius: 5,
		height: 10,
		width: 10
	},
	start: {
		marginTop: 18
	},
	sub: {
		fontSize: 13,
		lineHeight: 20,
		marginTop: 6
	},
	title: {
		fontSize: 22,
		lineHeight: 26.4
	}
});
