import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { HizbReadingState } from '@/api/hizbReading.api';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { BodyText, CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { HIZB_WORKS } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { hizbPlanBoard, type PlanCellState } from '@/lib/utils/hizbPlanBoard';
import { hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';

const labels: Record<PlanCellState, StringKey> = {
	read: 'hpBoardRead',
	partial: 'hpBoardPartial',
	pending: 'hpBoardPending',
	empty: 'hpBoardEmpty'
};
type Props = { data: HizbReadingState; onOpen: (id: string) => void };
export const HizbPlanOverview = memo(({ data, onOpen }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [selected, setSelected] = useState<number | null>(null);
	const cells = useMemo(
		() => hizbPlanBoard(data.members, data.coveredSpans ?? [], data.today),
		[data.members, data.coveredSpans, data.today]
	);
	if (!data.coveredSpans) {
		return null;
	}
	const colors = {
		read: theme.colors.accent,
		partial: theme.colors.sand,
		pending: theme.colors.accentSoft,
		empty: theme.colors.surfaceMuted
	};
	const textColors = {
		read: theme.colors.onAccent,
		partial: theme.colors.sandText,
		pending: theme.colors.accent,
		empty: theme.colors.subtext
	};
	const detail = cells.find(cell => cell.number === selected);
	return (
		<CardSurface style={styles.card}>
			<View style={styles.heading}>
				<TitleText>{t('groupProgress')}</TitleText>
				<CaptionText color={theme.colors.accent}>
					{t('hpBoardCount', { count: cells.filter(cell => cell.state === 'read').length })}
				</CaptionText>
			</View>
			<CaptionText color={theme.colors.subtext}>{t('hpBoardHint')}</CaptionText>
			<View style={styles.legend}>
				{(Object.keys(labels) as PlanCellState[]).map(state => (
					<View key={state} style={styles.legendItem}>
						<View
							style={[
								styles.swatch,
								{ backgroundColor: colors[state], borderColor: theme.colors.borderStrong }
							]}
						/>
						<CaptionText color={theme.colors.subtext}>{t(labels[state])}</CaptionText>
					</View>
				))}
				<View style={styles.legendItem}>
					<View style={[styles.swatch, { borderColor: theme.colors.text, borderWidth: 2 }]} />
					<CaptionText color={theme.colors.subtext}>{t('hpBoardMine')}</CaptionText>
				</View>
			</View>
			{HIZB_WORKS.map(work => (
				<View key={work.key} style={styles.work}>
					<View style={styles.row}>
						<CaptionText style={styles.workTitle} color={theme.colors.subtext}>
							{t(work.titleKey)}
						</CaptionText>
						<View style={styles.cells}>
							{cells.slice(work.parts[0] - 1, work.parts[1]).map(cell => (
								<Pressable
									key={cell.number}
									accessibilityRole='button'
									accessibilityState={{ expanded: selected === cell.number }}
									accessibilityLabel={`${t('portion')} ${cell.number}, ${t(labels[cell.state])}${
										cell.isMine ? `, ${t('hpBoardMine')}` : ''
									}`}
									onPress={() => setSelected(selected === cell.number ? null : cell.number)}
									style={({ pressed }) => [
										styles.cell,
										{
											backgroundColor: colors[cell.state],
											opacity: pressed ? 0.6 : 1,
											borderColor: cell.isMine
												? theme.colors.text
												: selected === cell.number
												? theme.colors.accent
												: theme.colors.transparent
										}
									]}
								>
									<CaptionText weight='semibold' color={textColors[cell.state]}>
										{cell.number}
									</CaptionText>
									{cell.state === 'partial' ? (
										<View style={[styles.partial, { backgroundColor: theme.colors.sandText }]} />
									) : null}
								</Pressable>
							))}
						</View>
					</View>
					{detail && detail.number >= work.parts[0] && detail.number <= work.parts[1] ? (
						<View style={[styles.detail, { backgroundColor: theme.colors.surfaceMuted }]}>
							<BodyText weight='semibold'>
								{t('portion')} {detail.number} · {t(labels[detail.state])}
							</BodyText>
							<CaptionText>{t(hizbPlanDescriptionKey(33, detail.number))}</CaptionText>
							{detail.readers.length ? (
								detail.readers.map(reader => (
									<View key={reader.id} style={styles.reader}>
										<BodyText>
											{reader.id === data.enrollment?.id
												? t('you')
												: reader.displayName ?? t('anonymousMember')}
										</BodyText>
										<CaptionText color={theme.colors.subtext}>
											{t('hpPortion', { days: reader.planDays, portion: reader.portion })} ·{' '}
											{t(reader.completed ? 'hpComplete' : 'hpPending')}
										</CaptionText>
									</View>
								))
							) : (
								<CaptionText color={theme.colors.subtext}>{t('hpBoardNoReaders')}</CaptionText>
							)}
							{detail.isMine && data.today ? (
								<AppButton
									title={t('hpRead')}
									onPress={() => onOpen(data.today!.id)}
									variant='surface'
								/>
							) : null}
						</View>
					) : null}
				</View>
			))}
			<CaptionText color={theme.colors.subtext}>{t('hpCoverageHint')}</CaptionText>
		</CardSurface>
	);
});
HizbPlanOverview.displayName = 'HizbPlanOverview';
const styles = StyleSheet.create({
	card: { gap: 12 },
	heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
	legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
	legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
	swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
	work: { gap: 8 },
	row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
	workTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 110 },
	cells: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
	cell: { width: 32, minHeight: 44, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
	partial: { width: 12, height: 2, borderRadius: 1, marginTop: 2 },
	detail: { padding: 12, borderRadius: 10, gap: 8 },
	reader: { gap: 2 }
});
