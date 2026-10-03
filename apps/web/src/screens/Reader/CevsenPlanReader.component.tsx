import { HintTarget } from '@/components/Hints/HintTarget.component';
import { useHintScreen } from '@/components/Hints/useHintScreen';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { CaptionText, EyebrowText, TitleText } from '@/components/ui/Typography/Typography.component';
import type { CevsenInvocation } from '@/lib/content/cevsen';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { useHizbAssignment, useHizbReading, useUpdateHizbAssignment } from '@/lib/hooks/useHizbReading';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { textFontFor } from '@/lib/types/domain';
import { canUndoHizbDay } from '@/lib/utils/hizbAhead';
import { BAB_COUNT } from '@/lib/utils/babs';
import { planUnitsOf } from '@/lib/utils/personalPlan';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import { MealSheet } from '@/screens/Reader/MealSheet.component';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { ReaderBody, readerFaces } from '@/screens/Reader/ReaderBody.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReaderSkeleton } from './ReaderSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'CevsenPlanReader'>;

/** No pool in a Şahsi plan — held steady for the strip, whose ticks are memoised on it. */
const NO_BABS: number[] = [];

/**
 * A Şahsi Cevşen reading's day: its babs one after another, as the Hizb plan's reader turns its
 * pages, and "Okudum" on the last one. The page is the Cevşen reader's own (`ReaderBody`, with
 * the meal on a long press); the place in the day is kept on the server as the reading's
 * bookmark — the index of the bab within the day — so it opens where it was left on any device.
 *
 * Read in the app only: a Cevşen day has no book to mark it from.
 */
export const CevsenPlanReader = ({ navigation, route }: Props) => {
	// The Aa in the bar (`ReaderToolbar`) opens it through the route, as in the other readers.
	const textSize = textSizeSheet(navigation, route.params);
	// The group reader's hints: Aa, the strip, "Okudum".
	useHintScreen('reader');

	return (
		<DayReader
			key={route.params.assignmentId}
			groupId={route.params.groupId}
			id={route.params.assignmentId}
			isTextSizeOpen={textSize.isVisible}
			onCloseTextSize={textSize.close}
		/>
	);
};

const DayReader = ({
	groupId,
	id,
	isTextSizeOpen,
	onCloseTextSize
}: {
	groupId: string;
	id: string;
	isTextSizeOpen: boolean;
	onCloseTextSize: () => void;
}) => {
	// A bab takes minutes of reading without touching the screen.
	useKeepAwake();
	const { t } = useTranslation();
	const text = useHizbPlanText('CEVSEN');
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const query = useHizbAssignment(groupId, id);
	const update = useUpdateHizbAssignment(groupId, id);
	// The group's state, fetched once and never polled from here — a reader opened straight from
	// Ana sayfa or a notification has no cache: how far ahead is read, for whether undo is open.
	const stateQuery = useHizbReading(groupId, true, { isPolling: false });
	// The strip under the title, as the group reader's: a drag or a tap anywhere along it opens
	// that bab. `scrubRatio` carries the finger on the UI thread; the title catches up.
	const scrubRatio = useSharedValue(-1);
	const lastScrubBab = useSharedValue(0);
	const [railWidth, setRailWidth] = useState(0);
	const [scrubBab, setScrubBab] = useState<number | null>(null);
	// A bab outside the day, opened from the strip or the arrows — read, never marked, from here.
	const [freeBab, setFreeBab] = useState<number | null>(null);
	// Today's babs, held steady for the strip's memoised ticks.
	const dayBabs = useMemo(
		() =>
			query.data ? query.data.units ?? planUnitsOf('CEVSEN', query.data.planDays, query.data.portion) : NO_BABS,
		[query.data]
	);
	// Read this round: the days read, and today's babs marked with "Okudum".
	const readBabNumbers = useMemo(() => {
		const reading = query.data;

		if (!reading) {
			return NO_BABS;
		}

		// Every day known read in this round before this one — past days, today and days read
		// ahead — so a day read ahead shows the babs read on the way to it.
		const roundStart = reading.day - (reading.portion - 1);
		const page = stateQuery.data?.pages[0];
		const earlier = [
			...(stateQuery.data?.pages.flatMap(each => each.assignments) ?? []),
			...(page?.today ? [page.today] : []),
			...(page?.aheadThrough?.readings ?? [])
		];
		const read = earlier
			.filter(day => day.day >= roundStart && day.day < reading.day && day.completedAt !== null)
			.flatMap(day => day.units ?? planUnitsOf('CEVSEN', reading.planDays, day.portion));
		const todays = reading.units ?? planUnitsOf('CEVSEN', reading.planDays, reading.portion);

		// Today's babs marked with "Okudum" — never just passed with the arrows.
		return [...new Set([...read, ...(reading.completedAt ? todays : reading.readPortions)])].sort((x, y) => x - y);
	}, [query.data, stateQuery.data]);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const scroll = useRef<ScrollView>(null);
	// Back to the top of a bab: a stable callback, so the strip's gesture — built in render — never
	// reaches into the ref itself.
	const scrollToTop = useCallback(() => scroll.current?.scrollTo({ animated: false, y: 0 }), []);
	/** The invocation whose meaning is open, or null. Held here so the sheet outlives the press. */
	const [mealInvocation, setMealInvocation] = useState<CevsenInvocation | null>(null);
	const settings = {
		// Hüsrev is the Kur'an's page images; the Cevşen sets text, so it falls back to a font.
		readerArabicFont: textFontFor(settingsQuery.data?.readerArabicFont ?? 'uthman'),
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	const faces = readerFaces(settings.readerArabicFont, settings.readerFontSize);
	const a = query.data;

	/*
	 * Where a finger lifts off the strip: that bab opens — the day's own at its place, any other to
	 * read only. Above the early returns, and left to the compiler to memoise, so the strip's gesture
	 * (built in render) hands the worklet nothing that reaches into a ref.
	 */
	const { mutate: saveReading } = update;
	/*
	 * A lift off the strip asks for the top of the page through state, not the ref: the callback is
	 * handed to the gesture during render, and one that reaches a ref fails the compiler's rules.
	 * Scrolled once the new bab has drawn.
	 */
	const [scrollRequest, setScrollRequest] = useState(0);

	useEffect(() => {
		if (scrollRequest > 0) {
			scrollToTop();
		}
	}, [scrollRequest, scrollToTop]);

	const commitScrub = (target: number) => {
		setScrubBab(null);
		setScrollRequest(current => current + 1);

		const reading = query.data;

		if (!reading) {
			return;
		}

		const index = (reading.units ?? planUnitsOf('CEVSEN', reading.planDays, reading.portion)).indexOf(target);

		if (index >= 0) {
			setFreeBab(null);
			saveReading({ bookmark: index });
		} else {
			setFreeBab(target);
		}
	};

	const trackScrub = (x: number) => {
		'worklet';

		if (railWidth <= 0) {
			return;
		}

		const ratio = Math.min(1, Math.max(0, x / railWidth));

		scrubRatio.value = ratio;

		const bab = Math.round(ratio * (BAB_COUNT - 1)) + 1;

		if (bab !== lastScrubBab.value) {
			lastScrubBab.value = bab;
			runOnJS(setScrubBab)(bab);
		}
	};
	// As the group reader's: down is a tap, a cancelled drag still lands where the finger left.
	const railGesture = Gesture.Pan()
		.minDistance(0)
		.hitSlop({ bottom: 10, top: 10 })
		.onBegin(event => trackScrub(event.x))
		.onUpdate(event => trackScrub(event.x))
		.onFinalize(() => {
			const ratio = scrubRatio.value;

			scrubRatio.value = -1;
			lastScrubBab.value = 0;

			if (ratio >= 0) {
				runOnJS(commitScrub)(Math.round(ratio * (BAB_COUNT - 1)) + 1);
			}
		});

	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}

	if (!a || settingsQuery.isPending) {
		return (
			<SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
				<ReaderSkeleton />
			</SafeAreaView>
		);
	}

	const babs = a.units ?? planUnitsOf('CEVSEN', a.planDays, a.portion);
	const cursor = Math.max(0, Math.min(a.bookmark, babs.length - 1));
	const dayBab = babs[cursor] ?? 1;
	// Any of the hundred can be read: the strip and the arrows walk them all. Only the day's own are
	// marked with "Okudum"; the place kept is always one of them.
	const babNumber = scrubBab ?? freeBab ?? dayBab;
	const isInDay = babs.includes(babNumber);
	const isLast = cursor >= babs.length - 1;
	// Predicted in the cache (see `useUpdateHizbAssignment`), so the bab is already the new one.
	const turnTo = (index: number) => {
		scrollToTop();
		setFreeBab(null);
		update.mutate({ bookmark: index });
	};
	const goToBab = (target: number) => {
		const index = babs.indexOf(target);

		if (index >= 0) {
			turnTo(index);

			return;
		}

		scrollToTop();
		setFreeBab(target);
	};
	// Only a second tap on "Okudum" while the first is out is dropped, so it can't undo itself.
	const isMarking =
		update.isPending && (update.variables?.read !== undefined || update.variables?.bookPortions !== undefined);
	// "Okudum" marks this bab — the arrows only move. The day is read once every bab of it is.
	const isBabRead = a.completedAt !== null || a.readPortions.includes(babNumber);
	const toggleBab = () => {
		if (isMarking) {
			return;
		}

		const marked = a.completedAt !== null ? babs : a.readPortions;
		const next = isBabRead
			? marked.filter(number => number !== babNumber)
			: [...marked, babNumber].sort((x, y) => x - y);

		if (next.length === 0) {
			update.mutate({ read: false });

			return;
		}

		// One write: the bab marked and, marking, the next bab opened — both shown at once. Every bab
		// marked reads the day; on a read day, un-marking one undoes it, keeping the rest.
		const isTurning = !isBabRead && !isLast;

		if (isTurning) {
			scrollToTop();
		}

		update.mutate({ bookPortions: next, ...(isTurning ? { bookmark: cursor + 1 } : {}) });
	};
	// Undo goes from the end: today, or a day read ahead, stays read while a later day is read.
	// Locked until the state says otherwise: offering "Geri al" the server then refuses is worse.
	const aheadState = stateQuery.data?.pages[0];
	const isUndoLocked = a.completedAt !== null && (!aheadState || !canUndoHizbDay(a.date, aheadState));

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.screen, { backgroundColor: theme.colors.readerSurface, paddingBottom: tabBarOffset }]}
		>
			<View style={styles.heading}>
				{/* The place in the day, centred between the bar's back button and its Aa pill. */}
				<View style={styles.placeRow}>
					<View style={styles.placeSide} />
					<View style={styles.placeCenter}>
						<EyebrowText color={theme.colors.faintText} numberOfLines={1}>
							{text.partsLabel(a)}
						</EyebrowText>
						<EyebrowText color={theme.colors.faintText}>
							{isInDay ? t('hpPage', { page: cursor + 1, total: babs.length }) : ' '}
						</EyebrowText>
					</View>
					<View style={styles.placeSide} />
				</View>
				<CaptionText>{[text.monthDay(a.date, 'long'), text.dayLabel(a)].join(' · ')}</CaptionText>
				<TitleText>{t('babOrdinal', { n: babNumber })}</TitleText>
				{/* The group reader's strip of the hundred: read this round, today's babs, the rest. A hint
				    points here, as in the group reader. */}
				<GestureDetector gesture={railGesture}>
					<View
						accessibilityRole='adjustable'
						accessibilityValue={{ max: BAB_COUNT, min: 1, now: babNumber }}
						onLayout={event => setRailWidth(event.nativeEvent.layout.width)}
						style={styles.babMap}
					>
						<HintTarget id='readerMap'>
							<ReaderBabMap
								count={BAB_COUNT}
								currentBab={babNumber}
								isPlan
								myBabNumbers={dayBabs}
								poolBabNumbers={NO_BABS}
								readBabNumbers={readBabNumbers}
								scrubRatio={scrubRatio}
							/>
						</HintTarget>
					</View>
				</GestureDetector>
			</View>
			<ScrollView ref={scroll} contentContainerStyle={styles.body} style={styles.scroll}>
				<ReaderBody
					babNumber={babNumber}
					font={settings.readerArabicFont}
					fontSize={settings.readerFontSize}
					numerals={settings.readerNumerals}
					onLongPressInvocation={setMealInvocation}
				/>
			</ScrollView>
			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				{update.isError ? (
					<CaptionText color={theme.colors.danger} style={styles.hint}>
						{t('hpError')}
					</CaptionText>
				) : (
					// The group reader's line under the text: the meal is a long press away.
					<CaptionText color={theme.colors.faintText} style={styles.hint}>
						{t('longPressHint')}
					</CaptionText>
				)}
				{isUndoLocked ? (
					<CaptionText color={theme.colors.faintText} style={styles.hint}>
						{t('hpUndoLaterFirst')}
					</CaptionText>
				) : null}
				<View style={styles.actions}>
					<AppButton
						accessibilityLabel={t('previousBab')}
						disabled={babNumber <= 1}
						fullWidth={false}
						icon='chevronLeft'
						onPress={() => goToBab(babNumber - 1)}
						variant='surface'
					/>
					{/* The group reader's green "Okudum" on every bab: it marks that bab and turns to the
					    next; on a bab already read it is "Geri al". The arrows only move. */}
					{/* Outside the day: nothing to mark here, only the way back to the day's own bab. */}
					{!isInDay ? (
						<AppButton
							onPress={() => goToBab(dayBab)}
							style={styles.fill}
							title={t('spBackToDay')}
							variant='surface'
						/>
					) : (
						<HintTarget id='readMark' style={styles.fill}>
							<AppButton
								disabled={a.completedAt !== null && isUndoLocked}
								onPress={toggleBab}
								title={t(
									isBabRead
										? a.completedAt !== null && isUndoLocked
											? 'hpStatusRead'
											: 'markUnread'
										: 'markRead'
								)}
								variant={isBabRead ? 'accentOutline' : 'accent'}
							/>
						</HintTarget>
					)}
					<AppButton
						accessibilityLabel={t('nextBab')}
						disabled={babNumber >= BAB_COUNT}
						fullWidth={false}
						icon='chevronRight'
						onPress={() => goToBab(babNumber + 1)}
						variant='surface'
					/>
				</View>
			</View>
			<TextSizeSheet
				isVisible={isTextSizeOpen}
				onChange={patch => updateSettings.mutate(patch)}
				onClose={onCloseTextSize}
				settings={settings}
			/>
			<MealSheet
				arabicFont={faces.arabicFont}
				arabicFontSize={faces.arabicFontSize}
				arabicText={mealInvocation?.text ?? ''}
				babNumber={babNumber}
				invocation={mealInvocation}
				numerals={settings.readerNumerals}
				onClose={() => setMealInvocation(null)}
			/>
		</SafeAreaView>
	);
};

/* The Hizb plan reader's measures, with the Cevşen reader's page padding. */
const styles = StyleSheet.create({
	hint: { lineHeight: 16, textAlign: 'center' },
	babMap: { marginTop: 6 },
	screen: { flex: 1 },
	heading: { gap: 6, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 8 },
	// Shares its band with the navigator's back button and Aa pill, as the Kur'an reader's does.
	placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
	// Each side reserves the wider of the bar's two ends (the Aa pill), so the middle is centred.
	placeSide: { flex: 1, minWidth: 96 },
	placeCenter: { alignItems: 'center', flexShrink: 1 },
	scroll: { flex: 1 },
	body: { paddingBottom: 26, paddingHorizontal: 22, paddingTop: 26 },
	footer: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, padding: 12 },
	actions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
	fill: { flex: 1 }
});
