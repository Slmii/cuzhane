import { TourTarget } from '@/components/Tour/TourTarget.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { isGlassButtonAvailable } from '@/components/ui/Button/GlassButton';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { CaptionText, TitleText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import type { RepetitionBoxProps } from './RepetitionBox.types';

/** The three the design offers by name; any other count from 1 to 100 is "Sayıyı gir". */
const PRESETS = [11, 33, 100] as const;
/** The segmented control's fourth value — "Sayıyı gir". */
const CUSTOM = 'custom';
const SHEET_MAX = 100;
/** The sheet's 1–100, ten to a row. */
const ROWS = Array.from({ length: SHEET_MAX / 10 }, (_, row) =>
	Array.from({ length: 10 }, (_, col) => row * 10 + col + 1)
);

/**
 * One light tap per recitation, so the count can be kept with the eyes on the page. Swallowed:
 * haptics are missing on web and off by a system setting elsewhere.
 */
const countTap = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};

/** T1d's small caps tag — "1 kez" over a passage read once (grey), "Tekrarla" over the repeated one (green). */
export const RepetitionTag = ({ label, isStrong = false }: { label: string; isStrong?: boolean }) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.tag, { backgroundColor: isStrong ? theme.colors.accent : theme.colors.segmentTrack }]}>
			<Typography
				color={isStrong ? theme.colors.onAccent : toAlphaColor(theme.colors.text, 0.55)}
				style={styles.tagLabel}
				variant='stat'
				weight='semibold'
			>
				{label}
			</Typography>
		</View>
	);
};

/**
 * T1d — a repeated passage and everything for it in one box: tapping the Arabic counts one; the
 * count, what is left and a bar; reset, one back and one more; and, for the istighfar only, how
 * many times (11 · 33 · 100 · any other, from a 1–100 sheet). Every repetition gate draws it —
 * the istighfar, Sekine ×19 and the Delâil salavat ×3. The box is the design's, by the pixel; the
 * buttons and the target row are the platform's own (`AppButton`, `SegmentedControl`).
 */
export const RepetitionBox = ({
	children,
	count,
	disabled,
	max,
	note,
	onCountChange,
	onTargetChange,
	target
}: RepetitionBoxProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	/** Bumped as the sheet closes, to remount the segmented control (see there). */
	const [sheetRound, setSheetRound] = useState(0);
	const [draft, setDraft] = useState(target);
	const closeSheet = () => {
		setIsSheetOpen(false);
		setSheetRound(round => round + 1);
	};
	const isCustom = !PRESETS.some(value => value === target);
	const isDone = count >= target;
	const ink = (alpha: number) => toAlphaColor(theme.colors.text, alpha);

	const setCount = (next: number) => {
		const clamped = Math.max(0, Math.min(max, next));

		onCountChange(clamped);
		AccessibilityInfo.announceForAccessibility(t('hizbRepetitions', { count: clamped, required: target }));
	};
	const addOne = () => {
		if (disabled || count >= max) {
			return;
		}

		countTap();
		setCount(count + 1);
	};

	const openSheet = () => {
		setDraft(target);
		setIsSheetOpen(true);
	};

	return (
		<View style={styles.section}>
			<View style={[styles.box, { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent }]}>
				<View style={styles.boxHead}>
					<RepetitionTag isStrong label={t('hpRepeatTag')} />
					{disabled ? null : (
						<CaptionText color={theme.colors.accent} style={styles.tapHint} weight='medium'>
							{t('hpTapText')}
						</CaptionText>
					)}
				</View>
				{/* The text: tapping it is one more, so the eyes can stay on it. */}
				<Pressable
					accessibilityHint={t('hpTapText')}
					accessibilityRole='button'
					disabled={disabled}
					onPress={addOne}
					style={({ pressed }) => [styles.text, { opacity: pressed ? 0.8 : 1 }]}
				>
					{children}
				</Pressable>

				<View
					style={[
						styles.counter,
						{
							backgroundColor: theme.colors.surface,
							borderTopColor: toAlphaColor(theme.colors.accent, 0.2)
						}
					]}
				>
					<View style={styles.countRow}>
						<Typography style={styles.countValue} variant='title' weight='regular'>
							{String(count)}
						</Typography>
						<Typography color={ink(0.42)} style={styles.countTarget} variant='title' weight='regular'>
							{`/ ${target}`}
						</Typography>
						<CaptionText
							color={isDone ? theme.colors.accent : ink(0.5)}
							style={styles.left}
							weight='semibold'
						>
							{isDone ? t('hpLeftDone') : t('hpLeftCount', { count: target - count })}
						</CaptionText>
					</View>
					<ProgressBar
						fillColor={theme.colors.accent}
						height={5}
						percent={Math.min(100, (count * 100) / Math.max(1, target))}
						trackColor={theme.colors.accentSoft}
					/>
					{/* The platform's own buttons: glass on iOS 26, the drawn ones elsewhere. H2 of the
					    first-use tour points at this row: counting is these three buttons. */}
					<TourTarget id='counter' style={styles.buttons}>
						<AppButton
							disabled={disabled || count === 0}
							fullWidth={false}
							icon='reset'
							onPress={() => setCount(0)}
							title={t('hpReset')}
							variant='tonal'
						/>
						<AppButton
							accessibilityLabel={t('hizbRepetitionRemoveLabel')}
							disabled={disabled || count === 0}
							// Hugging, as the reader footer's arrows are: a stretching disc is squeezed by its row.
							fullWidth={false}
							icon='minus'
							style={styles.minus}
							onPress={() => setCount(count - 1)}
							variant='tonal'
						/>
						<AppButton
							accessibilityLabel={t('hizbRepetitionAddLabel')}
							disabled={disabled || count >= max}
							icon='plus'
							onPress={addOne}
							style={styles.add}
							title={t('hizbRepetitionAdd')}
							variant='accent'
						/>
					</TourTarget>

					{onTargetChange ? (
						<View
							pointerEvents={disabled ? 'none' : 'auto'}
							style={[styles.howManyBlock, { opacity: disabled ? 0.6 : 1 }]}
						>
							<CaptionText color={ink(0.45)} style={styles.howMany} weight='semibold'>
								{t('hpHowMany').toLocaleUpperCase(language)}
							</CaptionText>
							{/*
							 * The platform's segmented control. The fourth is "Sayıyı gir", or the count it set;
							 * choosing it opens the 1–100 sheet. Remounted when the sheet closes, so a
							 * cancelled pick puts the native selection back on the target that stands.
							 */}
							<SegmentedControl
								key={sheetRound}
								onChange={value => (value === CUSTOM ? openSheet() : onTargetChange(Number(value)))}
								options={[
									...PRESETS.map(value => ({ label: String(value), value: String(value) })),
									{
										isWide: true,
										label: isCustom ? t('hpTimesCustom', { count: target }) : t('hpEnterCount'),
										value: CUSTOM
									}
								]}
								style={styles.targets}
								value={isCustom ? CUSTOM : String(target)}
							/>
						</View>
					) : null}
					{note ? <CaptionText color={theme.colors.subtext}>{note}</CaptionText> : null}
				</View>
			</View>

			{onTargetChange ? (
				<AppBottomSheet isVisible={isSheetOpen} onClose={closeSheet}>
					<View style={styles.sheet}>
						<View style={styles.sheetHead}>
							<TitleText style={styles.sheetTitle} weight='regular'>
								{t('hpTargetSheetTitle')}
							</TitleText>
							<Typography
								color={theme.colors.accent}
								style={styles.sheetDraft}
								variant='title'
								weight='regular'
							>
								{String(draft)}
							</Typography>
						</View>
						{/* On a card: the sheet's glass stays out of the gaps. */}
						<CardSurface>
							<View style={styles.grid}>
								{ROWS.map(row => (
									<View key={row[0]} style={styles.gridRow}>
										{row.map(value => {
											const isPicked = value === draft;
											const isPreset = PRESETS.some(preset => preset === value);

											return (
												<Pressable
													accessibilityLabel={t('hpTimesCustom', { count: value })}
													accessibilityRole='radio'
													accessibilityState={{ selected: isPicked }}
													key={value}
													onPress={() => setDraft(value)}
													style={[
														styles.cell,
														{
															backgroundColor: isPicked
																? theme.colors.accent
																: isPreset
																? theme.colors.accentSoft
																: theme.colors.segmentTrack,
															borderColor: isPicked
																? theme.colors.text
																: theme.colors.transparent
														}
													]}
												>
													<CaptionText
														color={
															isPicked
																? theme.colors.onAccent
																: isPreset
																? theme.colors.accent
																: theme.colors.text
														}
														style={styles.cellLabel}
														weight='semibold'
													>
														{String(value)}
													</CaptionText>
												</Pressable>
											);
										})}
									</View>
								))}
							</View>
						</CardSurface>
						<AppButton
							onPress={() => {
								closeSheet();

								if (draft !== target) {
									onTargetChange(draft);
								}
							}}
							title={t('hpTargetSet', { count: draft })}
							size='lg'
							variant='primary'
						/>
					</View>
				</AppBottomSheet>
			) : null}
		</View>
	);
};

// T1d, by the pixel.
const styles = StyleSheet.create({
	add: { flex: 1 },
	box: { borderRadius: 20, borderWidth: 1.5, overflow: 'hidden' },
	boxHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 14,
		paddingTop: 12
	},
	buttons: { alignItems: 'center', flexDirection: 'row', gap: 8 },
	cell: { alignItems: 'center', aspectRatio: 1, borderRadius: 7, borderWidth: 2, flex: 1, justifyContent: 'center' },
	cellLabel: { fontSize: 11, lineHeight: 14 },
	counter: { borderTopWidth: 1, gap: 11, paddingBottom: 14, paddingHorizontal: 14, paddingTop: 12 },
	countRow: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
	countTarget: { fontSize: 17, lineHeight: 17 },
	countValue: { fontSize: 30, lineHeight: 30 },
	grid: { gap: 4 },
	gridRow: { flexDirection: 'row', gap: 4 },
	howMany: { fontSize: 10, letterSpacing: 0.6, lineHeight: 14 },
	howManyBlock: { gap: 6 },
	/*
	 * The "−" disc as tall as its two neighbours. On glass a pinned size is the glyph's frame and
	 * the disc adds 15pt a side around it (measured: 32 came out 62), so 18 makes the 48 the
	 * "Sıfırla" capsule measures; the drawn disc has no such padding and takes the drawn large
	 * button's 54 as it is.
	 */
	minus: isGlassButtonAvailable ? { height: 18, width: 18 } : { height: 54, width: 54 },
	left: { fontSize: 11, lineHeight: 14, marginLeft: 'auto' },
	section: { marginBottom: 22 },
	sheet: { gap: 14, paddingBottom: 2 },
	sheetDraft: { fontSize: 22, lineHeight: 22 },
	sheetHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
	sheetTitle: { fontSize: 20, lineHeight: 25 },
	tag: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
	tagLabel: { fontSize: 9.5, letterSpacing: 0.57, lineHeight: 12 },
	tapHint: { fontSize: 10.5, lineHeight: 14 },
	// The native control reports no width of its own; it takes the box's.
	targets: { alignSelf: 'stretch' },
	text: { paddingBottom: 10, paddingHorizontal: 14, paddingTop: 6 }
});
