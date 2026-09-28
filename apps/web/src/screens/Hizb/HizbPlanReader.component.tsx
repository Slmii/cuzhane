import { useContext, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import type { TabStackParamList } from '@/navigation/types';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { HizbAssignmentPatch } from '@/api/hizbReading.api';
import { useHizbAssignment, useUpdateHizbAssignment } from '@/lib/hooks/useHizbReading';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { hizbPartsLabel } from '@/lib/utils/groups';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { planBlocks } from '@/lib/content/hizbPlans';
import { splitIstighfar } from '@/lib/content/hizbIstighfar';
import { HIZB_SECTIONS, isCevsenSection } from '@/lib/content/hizbulhakaik';
import { hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';
import { AppButton } from '@/components/ui/Button/Button.component';
import { FlatButton } from '@/components/FlatButton/FlatButton.component';
import { BodyText, CaptionText, EyebrowText, TitleText } from '@/components/ui/Typography/Typography.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import { HizbPlanReaderSkeleton } from './HizbPlanReaderSkeleton.component';
import { HizbBody } from './HizbBody.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbPlanReader'>;
export const HizbPlanReader = ({ navigation, route }: Props) => {
	// The Aa in the bar (`ReaderToolbar`) opens it through the route, as in the other readers.
	const textSize = textSizeSheet(navigation, route.params);

	return (
		<AssignmentReader
			key={route.params.assignmentId}
			groupId={route.params.groupId}
			id={route.params.assignmentId}
			isTextSizeOpen={textSize.isVisible}
			onCloseTextSize={textSize.close}
		/>
	);
};
const AssignmentReader = ({
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
	useKeepAwake();
	const { t } = useTranslation();
	const text = useHizbPlanText();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const query = useHizbAssignment(groupId, id);
	const update = useUpdateHizbAssignment(groupId, id);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const scroll = useRef<ScrollView>(null);
	const a = query.data;
	const planDays = a?.planDays;
	const portion = a?.portion;
	const blocks = useMemo(() => (planDays && portion ? planBlocks(planDays, portion) : []), [planDays, portion]);
	const settings = {
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'uthman',
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}
	if (!a || !blocks.length) {
		return <HizbPlanReaderSkeleton />;
	}
	const cursor = Math.min(a.bookmark, blocks.length - 1);
	const current = blocks[cursor];
	const isSekine = current.sectionIndex === 10;
	const change = (patch: Omit<HizbAssignmentPatch, 'version'>) => {
		// Predicted in the cache (see `useUpdateHizbAssignment`), so the page is already the new one.
		if (patch.bookmark !== undefined || patch.repetitions !== undefined) {
			scroll.current?.scrollTo({ y: 0, animated: false });
		}

		update.mutate(patch);
	};
	/*
	 * Nothing here is disabled while a write is out — a disabled control fades, and the footer
	 * and the counters flickered on every tap. Writes queue in order instead (the hook's scope).
	 * Only a second tap on "read" while the first is out is dropped, so it can't undo itself.
	 */
	const isMarking = update.isPending && update.variables?.read !== undefined;
	const istighfarLeft = Math.max(0, a.istighfarTarget - a.istighfarRepetitions);
	// The istighfar's page, before the day is read and with a page after it to turn to (T1d).
	const isIstighfarGate =
		!a.completedAt && a.requiresIstighfar && cursor < blocks.length - 1 && splitIstighfar(current.block) !== null;
	const turnTo = (page: number) => change({ bookmark: page });
	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.screen, { backgroundColor: theme.colors.readerSurface, paddingBottom: tabBarOffset }]}
		>
			<View style={styles.heading}>
				{/*
				 * The place in the reading, centred on the screen as the Kur'an reader's is: its own
				 * row under the bar, between two equal side slots. As the bar's title it was centred
				 * between the back button and the wider Aa pill, so it sat left of centre. Two lines,
				 * because the section titles are too long for one between the bar's buttons.
				 */}
				<View style={styles.placeRow}>
					<View style={styles.placeSide} />
					<View style={styles.placeCenter}>
						<EyebrowText color={theme.colors.faintText} numberOfLines={1}>
							{HIZB_SECTIONS[current.sectionIndex].title}
						</EyebrowText>
						<EyebrowText color={theme.colors.faintText}>
							{t('hpPage', { page: cursor + 1, total: blocks.length })}
						</EyebrowText>
					</View>
					<View style={styles.placeSide} />
				</View>
				{/* The group card's words: "28 Eylül · 15 gün · 5. gün · 11–13. bölüm" — "bölüm" is only ever
				    one of the 33, never the plan's own count. */}
				<CaptionText>
					{[
						text.monthDay(a.date, 'long'),
						t('hpPlanDay', { days: a.planDays, day: a.portion }),
						hizbPartsLabel(text.portionsLabel(a), t)
					].join(' · ')}
				</CaptionText>
				<TitleText>{t(hizbPlanDescriptionKey(a.planDays, a.portion))}</TitleText>
			</View>
			<ScrollView ref={scroll} contentContainerStyle={styles.body} style={styles.scroll}>
				{isSekine ? <BodyText>{t('hpSekine')}</BodyText> : null}
				<HizbBody
					// Whole, every lap: `HizbBody` cuts Sekine's once-read opening off by the text itself.
					block={current.block}
					delailProgress={{
						count: a.delailRepetitions,
						disabled: a.completedAt !== null,
						onChange: count => change({ delailRepetitions: count })
					}}
					istighfarProgress={{
						count: a.istighfarRepetitions,
						target: a.istighfarTarget,
						disabled: a.completedAt !== null,
						onChange: change
					}}
					// Each count scrolls back to the top for the next lap (`change`).
					{...(isSekine
						? {
								sekineProgress: {
									count: a.repetitions,
									disabled: a.completedAt !== null,
									onChange: repetitions => change({ repetitions })
								}
						  }
						: {})}
					font={settings.readerArabicFont}
					fontSize={settings.readerFontSize}
					numerals={settings.readerNumerals}
					isCevsenBab={isCevsenSection(current.sectionIndex)}
				/>
			</ScrollView>
			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				{update.isError ? (
					<CaptionText color={theme.colors.danger} style={styles.hint}>
						{t('hpError')}
					</CaptionText>
				) : null}
				{a.requiresSekine && a.repetitions < 19 ? (
					<CaptionText color={theme.colors.faintText} style={styles.hint}>
						{t('hpSekine')} ({a.repetitions}/19)
					</CaptionText>
				) : null}
				{/* On the istighfar's page the note is always there, and says so once it is done (T1d). */}
				{!a.completedAt && a.requiresIstighfar && (istighfarLeft > 0 || isIstighfarGate) ? (
					<CaptionText color={theme.colors.faintText} style={styles.hint}>
						{istighfarLeft > 0 ? t('hpIstighfarLeft', { count: istighfarLeft }) : t('hpIstighfarDone')}
					</CaptionText>
				) : null}
				{!a.completedAt && a.requiresDelailRepetition && a.delailRepetitions < 3 ? (
					<CaptionText color={theme.colors.faintText} style={styles.hint}>
						{t('hpDelailRemaining', { count: a.delailRepetitions })}
					</CaptionText>
				) : null}
				{/*
				 * T1d: on the istighfar's own page the bar is "Sonraki sayfa" alone, greyed until the
				 * count reaches the target — the note above it says how many are left.
				 */}
				{isIstighfarGate ? (
					<FlatButton
						disabled={istighfarLeft > 0}
						onPress={() => turnTo(cursor + 1)}
						style={styles.gateButton}
						title={t('nextPage')}
						variant='ink'
					/>
				) : (
					<View style={styles.actions}>
						<AppButton
							accessibilityLabel={t('abPrev')}
							icon='chevronLeft'
							fullWidth={false}
							variant='surface'
							onPress={() => turnTo(cursor - 1)}
							disabled={cursor === 0}
						/>
						{/* The day is one reading across its pages, so it is marked only from the last one;
					    before that the button turns the page. Undo stays on every page. */}
						{!a.completedAt && cursor < blocks.length - 1 ? (
							<AppButton
								style={styles.fill}
								title={t('nextPage')}
								onPress={() => turnTo(cursor + 1)}
								variant='surface'
							/>
						) : (
							<AppButton
								style={styles.fill}
								title={t(a.completedAt ? 'hpUndo' : 'hpFinish')}
								onPress={() => {
									if (!isMarking) {
										change({ read: !a.completedAt });
									}
								}}
								disabled={
									!a.completedAt &&
									((a.requiresSekine && a.repetitions < 19) ||
										(a.requiresDelailRepetition && a.delailRepetitions < 3) ||
										(a.requiresIstighfar && a.istighfarRepetitions < a.istighfarTarget))
								}
								variant={a.completedAt ? 'surface' : 'accent'}
							/>
						)}
						<AppButton
							accessibilityLabel={t('abNext')}
							icon='chevronRight'
							fullWidth={false}
							variant='surface'
							onPress={() => turnTo(cursor + 1)}
							disabled={cursor === blocks.length - 1}
						/>
					</View>
				)}
			</View>
			<TextSizeSheet
				isVisible={isTextSizeOpen}
				onClose={onCloseTextSize}
				settings={settings}
				onChange={patch => updateSettings.mutate(patch)}
			/>
		</SafeAreaView>
	);
};
const styles = StyleSheet.create({
	// The Cevşen reader's line above its button: faint, centred.
	hint: { lineHeight: 16, textAlign: 'center' },
	// T1d's footer sets its button 20 in from the edge; the footer itself pads 12.
	gateButton: { marginHorizontal: 8 },
	screen: { flex: 1 },
	heading: { paddingHorizontal: 20, paddingTop: 8, gap: 6, paddingBottom: 8 },
	// Shares its band with the navigator's back button and Aa pill, as the Kur'an reader's does.
	placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
	// Each side reserves the wider of the bar's two ends (the Aa pill), so the middle is centred.
	placeSide: { flex: 1, minWidth: 96 },
	placeCenter: { alignItems: 'center', flexShrink: 1 },
	scroll: { flex: 1 },
	body: { padding: 22, gap: 18 },
	footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
	actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	fill: { flex: 1 }
});
