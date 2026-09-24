import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { Ornament } from '@/components/ui/Ornament/Ornament.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { MealSheetViewProps } from './MealSheetView.types';

/** The design's ornament size in a sheet header — its default, between inline and section-head. */
const ORNAMENT_SIZE = 26;
/** The body's tallest, as a share of the screen, before it scrolls — the sheet's title sits above. */
const MAX_BODY_HEIGHT_RATIO = 0.7;

/**
 * The meaning of one invocation or verse, opened by long-pressing it in a reader — **one layout
 * for both**, so the Cevşen's sheet and the Kuran's cannot drift apart. What goes in it is the
 * callers' business: `MealSheet` for the Cevşen's bundled meal, `VerseMealSheet` for a verse's,
 * fetched live.
 *
 * No close button, per the app's sheet rules: the grabber, a drag and the backdrop dismiss it.
 * The design draws an × here; every other sheet in the app does without one, and one sheet
 * inventing a second convention is worse than differing from the mock.
 */
export const MealSheetView = ({
	arabicFont,
	arabicFontSize,
	arabicText,
	credit,
	footer,
	isVisible,
	meal,
	message,
	number,
	numerals,
	onClose,
	ornamentColor,
	reference
}: MealSheetViewProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const { height: windowHeight } = useWindowDimensions();

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose} title={t('mealTitle')}>
			{/*
			 * The sheet stays mounted so it can animate; its body is drawn only while it is open.
			 * **It scrolls past a cap**, because the sheet sizes to what it holds and a long verse
			 * does not fit: Bakara 282 at a large size, Arabic and meal together, ran past the
			 * bottom of the screen with the meal unreachable. Below the cap it is exactly as tall
			 * as its content, so a short verse keeps a short sheet.
			 */}
			{isVisible ? (
				<ScrollView
					contentContainerStyle={styles.root}
					showsVerticalScrollIndicator={false}
					style={{ maxHeight: Math.round(windowHeight * MAX_BODY_HEIGHT_RATIO) }}
				>
					<View style={styles.header}>
						{/*
						 * The app's own rosette — `ui/Ornament`, the mark that opens every bab — carrying
						 * this ayah's number.
						 *
						 * It was briefly the typeface's `U+06DD` instead, so that the sheet and the text
						 * beside it drew the same shape. That needs the mark and its digits in one
						 * right-to-left run to enclose, which a left-to-right header row does not give
						 * it, and it came out as a bare flourish with the number nowhere on it. The drawn
						 * rosette has no such dependency: it is a view, sets its own numeral, and is legal
						 * here because a header is not running text.
						 */}
						<Ornament
							backgroundColor={theme.colors.surface}
							color={ornamentColor}
							n={number}
							numerals={numerals}
							size={ORNAMENT_SIZE}
						/>
						<Typography color={theme.colors.faintText} variant='mono'>
							{reference}
						</Typography>
					</View>

					<View
						style={[
							styles.card,
							{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
						]}
					>
						<Typography
							style={{
								fontFamily: arabicFont,
								fontSize: arabicFontSize,
								lineHeight: arabicFontSize * 1.95,
								writingDirection: 'rtl'
							}}
							textAlign='right'
						>
							{arabicText}
						</Typography>
						<View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
						{/* Muted when it is the app explaining itself rather than the text speaking. */}
						<Typography color={meal ? theme.colors.text : theme.colors.subtext}>
							{meal ?? message}
						</Typography>
						{meal && credit ? (
							<Typography color={theme.colors.faintText} variant='caption'>
								{credit}
							</Typography>
						) : null}
					</View>

					{footer}
				</ScrollView>
			) : null}
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	card: {
		borderRadius: 16,
		borderWidth: 1,
		gap: 13,
		padding: 15
	},
	divider: {
		height: 1
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	root: {
		gap: 12
	}
});
