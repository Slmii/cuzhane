import { useContext, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';
import { AppButton } from '@/components/ui/Button/Button.component';
import { BodyText, CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { RepetitionCounter } from '@/components/RepetitionCounter/RepetitionCounter.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { GroupDetailSkeleton } from '@/screens/Groups/GroupDetailSkeleton.component';
import { HizbBody } from './HizbBody.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbPlanReader'>;
export const HizbPlanReader = ({ route }: Props) => (
	<AssignmentReader key={route.params.assignmentId} groupId={route.params.groupId} id={route.params.assignmentId} />
);
const AssignmentReader = ({ groupId, id }: { groupId: string; id: string }) => {
	useKeepAwake();
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const query = useHizbAssignment(groupId, id);
	const update = useUpdateHizbAssignment(groupId, id);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const [settingsOpen, setSettingsOpen] = useState(false);
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
		return <GroupDetailSkeleton />;
	}
	const cursor = Math.min(a.bookmark, blocks.length - 1);
	const current = blocks[cursor];
	const isSekine = current.sectionIndex === 10;
	// The first lap includes the opening. Later laps resume at Bismillah, not the takbirs.
	const block =
		isSekine && a.repetitions > 0 ? { ...current.block, lines: current.block.lines.slice(2) } : current.block;
	const change = (patch: Omit<HizbAssignmentPatch, 'version'>) =>
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
	const busy = update.isPending || query.isFetching;
	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.screen, { backgroundColor: theme.colors.readerSurface, paddingBottom: tabBarOffset }]}
		>
			<View style={styles.heading}>
				<CaptionText>
					{a.date} · {t('hpPortion', { days: a.planDays, portion: a.portion })}
				</CaptionText>
				<TitleText>{t(hizbPlanDescriptionKey(a.planDays, a.portion))}</TitleText>
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
						disabled: busy || a.completedAt !== null,
						onChange: count => change({ delailRepetitions: count })
					}}
					istighfarProgress={{
						count: a.istighfarRepetitions,
						target: a.istighfarTarget,
						disabled: busy || a.completedAt !== null,
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
						isDisabled={busy || a.completedAt !== null}
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
							busy ||
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
	heading: { paddingHorizontal: 20, paddingTop: 52, gap: 6, paddingBottom: 8 },
	scroll: { flex: 1 },
	body: { padding: 22, gap: 18 },
	footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
	actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	fill: { flex: 1 }
});
