import { useContext, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import type { TabStackParamList } from '@/navigation/types';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { HizbAssignmentPatch } from '@/api/hizbReading.api';
import { useHizbAssignment, useUpdateHizbAssignment } from '@/lib/hooks/useHizbReading';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { planBlocks } from '@/lib/content/hizbPlans';
import { HIZB_SECTIONS, isCevsenSection } from '@/lib/content/hizbulhakaik';
import { formatPlanDate, hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { RepetitionCounter } from '@/components/RepetitionCounter/RepetitionCounter.component';
import { ReaderSkeleton } from '@/screens/Reader/ReaderSkeleton.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { HizbBody } from './HizbBody.component';

/** A tap back when a reading is marked — the other two readers', and swallowed for their reasons. */
const tapBack = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
};

type Props = NativeStackScreenProps<TabStackParamList, 'HizbPlanReader'>;
export const HizbPlanReader = ({ route }: Props) => (
	<AssignmentReader key={route.params.assignmentId} groupId={route.params.groupId} id={route.params.assignmentId} />
);
const AssignmentReader = ({ groupId, id }: { groupId: string; id: string }) => {
	useKeepAwake();
	const { t, language } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const query = useHizbAssignment(groupId, id);
	const update = useUpdateHizbAssignment(groupId, id);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [previewBookmark, setPreviewBookmark] = useState<number | null>(null);
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
		// A reader's bones, not a group screen's: the page that lands here is a page of text.
		return (
			<SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.readerSurface }]}>
				<ReaderSkeleton />
			</SafeAreaView>
		);
	}
	const cursor = Math.min(previewBookmark ?? a.bookmark, blocks.length - 1);
	const current = blocks[cursor];
	const isSekine = current.sectionIndex === 10;
	// The first lap includes the opening. Later laps resume at Bismillah, not the takbirs.
	const block =
		isSekine && a.repetitions > 0 ? { ...current.block, lines: current.block.lines.slice(2) } : current.block;
	const change = (patch: Omit<HizbAssignmentPatch, 'version'>) => {
		if (a.canEdit === false) {
			if (patch.bookmark !== undefined) {
				setPreviewBookmark(patch.bookmark);
				scroll.current?.scrollTo({ y: 0, animated: false });
			}
			return;
		}
		setPreviewBookmark(null);
		if (patch.read) {
			tapBack();
		}
		update.mutate(
			{ version: a.version, ...patch },
			{
				onSuccess: () => {
					if (patch.bookmark !== undefined || patch.repetitions !== undefined) {
						scroll.current?.scrollTo({ y: 0, animated: false });
					}
				}
			}
		);
	};
	const busy = update.isPending || query.isFetching;
	const editingDisabled = busy || a.canEdit === false;
	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.screen, { backgroundColor: theme.colors.readerSurface, paddingBottom: tabBarOffset }]}
		>
			<View style={styles.heading}>
				{a.canEdit === false && !a.completedAt ? <CaptionText>{t('helpClaimed')}</CaptionText> : null}
				{a.completedByOther ? <CaptionText>{t('helpCompleted')}</CaptionText> : null}
				<CaptionText>
					{formatPlanDate(a.date, language, true)} ·{' '}
					{t('hpPortion', { days: a.planDays, portion: a.portion })}
				</CaptionText>
				<TitleText>{t(hizbPlanDescriptionKey(a.planDays, a.portion))}</TitleText>
				<View
					accessibilityLiveRegion='polite'
					style={[
						styles.readStatus,
						{ backgroundColor: a.completedAt ? theme.colors.accentSoft : theme.colors.surfaceMuted }
					]}
				>
					{a.completedAt ? (
						<Icon color={theme.colors.accent} name='check' size={14} strokeWidth={2.1} />
					) : null}
					<BodyText weight='semibold' color={a.completedAt ? theme.colors.accent : theme.colors.subtext}>
						{t(a.completedAt ? 'hpTodayDone' : 'hpTodayPending')}
					</BodyText>
				</View>
				<CaptionText>
					{HIZB_SECTIONS[current.sectionIndex].title} ·{' '}
					{t('hpPage', { page: cursor + 1, total: blocks.length })}
				</CaptionText>
				<AppButton title={t('textSize')} onPress={() => setSettingsOpen(true)} variant='ghost' size='sm' />
			</View>
			<ScrollView ref={scroll} contentContainerStyle={styles.body} style={styles.scroll}>
				{isSekine ? <BodyText>{t('hpSekine')}</BodyText> : null}
				<HizbBody
					block={block}
					delailProgress={{
						count: a.delailRepetitions,
						disabled: editingDisabled || a.completedAt !== null,
						onChange: count => change({ delailRepetitions: count })
					}}
					istighfarProgress={{
						count: a.istighfarRepetitions,
						target: a.istighfarTarget,
						disabled: editingDisabled || a.completedAt !== null,
						onChange: change
					}}
					font={settings.readerArabicFont}
					fontSize={settings.readerFontSize}
					numerals={settings.readerNumerals}
					isCevsenBab={isCevsenSection(current.sectionIndex)}
				/>
			</ScrollView>
			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				{isSekine ? (
					<RepetitionCounter
						count={a.repetitions}
						required={19}
						isDisabled={editingDisabled || a.completedAt !== null}
						onChange={repetitions => change({ repetitions })}
					/>
				) : null}
				{update.isError ? <CaptionText color={theme.colors.danger}>{t('hpError')}</CaptionText> : null}
				{a.requiresSekine && a.repetitions < 19 ? (
					<CaptionText>
						{t('hpSekine')} ({a.repetitions}/19)
					</CaptionText>
				) : null}
				{!a.completedAt && a.requiresIstighfar && a.istighfarRepetitions < a.istighfarTarget ? (
					<CaptionText>
						{t('hpIstighfarRemaining', { count: a.istighfarRepetitions, target: a.istighfarTarget })}
					</CaptionText>
				) : null}
				{!a.completedAt && a.requiresDelailRepetition && a.delailRepetitions < 3 ? (
					<CaptionText>{t('hpDelailRemaining', { count: a.delailRepetitions })}</CaptionText>
				) : null}
				<View style={styles.actions}>
					<AppButton
						accessibilityLabel={t('abPrev')}
						icon='chevronLeft'
						fullWidth={false}
						variant='surface'
						onPress={() => change({ bookmark: cursor - 1 })}
						disabled={cursor === 0 || busy}
					/>
					<AppButton
						style={styles.fill}
						title={t(a.completedAt ? 'hpUndo' : 'hpFinish')}
						onPress={() => change({ read: !a.completedAt })}
						disabled={
							editingDisabled ||
							(!a.completedAt &&
								((a.requiresSekine && a.repetitions < 19) ||
									(a.requiresDelailRepetition && a.delailRepetitions < 3) ||
									(a.requiresIstighfar && a.istighfarRepetitions < a.istighfarTarget)))
						}
						variant={a.completedAt ? 'surface' : 'accent'}
					/>
					<AppButton
						accessibilityLabel={t('abNext')}
						icon='chevronRight'
						fullWidth={false}
						variant='surface'
						onPress={() => change({ bookmark: cursor + 1 })}
						disabled={cursor === blocks.length - 1 || busy}
					/>
				</View>
			</View>
			<TextSizeSheet
				isVisible={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				settings={settings}
				onChange={patch => updateSettings.mutate(patch)}
			/>
		</SafeAreaView>
	);
};
const styles = StyleSheet.create({
	screen: { flex: 1 },
	readStatus: {
		alignItems: 'center',
		borderRadius: 10,
		flexDirection: 'row',
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 8
	},
	heading: { paddingHorizontal: 20, paddingTop: 52, gap: 6, paddingBottom: 8 },
	scroll: { flex: 1 },
	body: { padding: 22, gap: 18 },
	footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
	actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	fill: { flex: 1 }
});
