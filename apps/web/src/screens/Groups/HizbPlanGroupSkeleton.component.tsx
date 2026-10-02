import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import type { CachedGroupShape } from '@/lib/hooks/useCachedGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { kindLabelKey } from '@/lib/utils/groups';
import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

/** S6's short history: today and the four readings before it. */
const HISTORY_ROWS = 5;

type Props = { plan: NonNullable<CachedGroupShape['plan']> };
type BoneWidth = number | `${number}%`;

/**
 * `HizbPlanGroup` before its reading answers — its W1 (shared) or S6 (individual) layout, with
 * every measure taken from that screen's own styles. The heading is the real one: the name, the
 * chips and the subtitle are all known from the group already. So are the two section eyebrows
 * and the 33 cells, which are drawn as they will be, only empty.
 *
 * Returned as the container's own children, as the screen's are, so the column's gap between
 * the heading, the body and the leave button is the same one. Picking (S1) and removed (S3)
 * can't be told from the cache and load under the shared layout.
 */
export const HizbPlanGroupSkeleton = ({ plan }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;
	const isShared = !plan.hizbIndividual;
	const planLabel = plan.hizbPlan ? t('hpDays', { days: plan.hizbPlan }) : t('hpMixedPlan');
	// A 7- or 15-day plan's day covers several of the 33, named as chips under the title.
	const hasPortionChips = plan.hizbPlan === 7 || plan.hizbPlan === 15;

	const cells = useMemo<CellGridItem[]>(
		() =>
			Array.from({ length: 33 }, (_, index) => ({
				backgroundColor: theme.colors.segmentTrack,
				key: index + 1,
				label: index + 1,
				labelColor: theme.colors.faintText
			})),
		[theme]
	);

	/** A bone centred in a text line of the given height, as the text will sit. */
	const line = (lineHeight: number, height: number, width: BoneWidth, tone: 'soft' | 'strong' = 'soft') => (
		<View style={[styles.line, { height: lineHeight }]}>
			<Bone height={height} radius={height / 2} tone={tone} width={width} />
		</View>
	);

	const eyebrow = (label: string) => (
		<Typography color={theme.colors.faintText} style={styles.sectionEyebrow} variant='eyebrow' weight='medium'>
			{label}
		</Typography>
	);

	const legend = (
		<View style={styles.legend}>
			{[44, 40, 52].map(width => (
				<View key={width} style={styles.legendKey}>
					<Bone height={9} radius={3} width={9} />
					{line(17, 7, width)}
				</View>
			))}
		</View>
	);

	const bannerBone = toAlphaColor(theme.colors.onHeaderSurface, 0.28);

	return (
		<>
			<ScreenHeader
				hasBackButton
				subtitle={
					isShared
						? t('hpMembersDaily', { count: plan.memberCount })
						: t('hpSubtitleIndividual', { days: plan.hizbPlan, start: plan.hizbStartPortion })
				}
				title={plan.name}
				titleLines={1}
				titleTrailing={
					<View style={styles.titleChips}>
						{isShared ? (
							<Chip label={planLabel} tone='accent' />
						) : (
							<Chip label={t('hpIndividualChip')} tone='neutral' />
						)}
						<Chip label={t(kindLabelKey('HIZB'))} tone='neutral' />
					</View>
				}
			/>

			<SkeletonPulse style={styles.body}>
				{eyebrow(t('hpMyProgress'))}

				{/* Today's card: date and tag, the title, its description, the button, the reset row. */}
				<CardSurface isFlush style={styles.cardGap}>
					<View style={styles.todayBody}>
						<View style={styles.spread}>
							{line(14, 8, 96)}
							<Bone height={22} radius={6} tone='soft' width={64} />
						</View>
						<View style={styles.readingTitle}>{line(26.25, 15, '56%', 'strong')}</View>
						{/* A single portion has its description; a day of several has its chips instead. */}
						{hasPortionChips ? null : <View style={styles.readingDesc}>{line(18.75, 9, '82%')}</View>}
						{hasPortionChips ? (
							<View style={styles.portionChips}>
								{[24, 24, 24].map((width, index) => (
									<Bone height={22} key={index} radius={6} tone='soft' width={width} />
								))}
								<View style={styles.portionCount}>{line(22, 8, 52)}</View>
							</View>
						) : null}
						<Bone height={48} radius={15} style={styles.darkButton} width='100%' />
					</View>
					<View style={[styles.footRow, { borderTopColor: divider }]}>
						<Bone height={15} radius={7.5} width={15} />
						<View style={styles.flex}>{line(17, 9, '58%')}</View>
						{line(17, 8, 72)}
					</View>
				</CardSurface>

				{/* "Senin ilerlemen" — the band's own fill, its bones tinted out of its text colour. */}
				<CardSurface
					hasGlassSurface={false}
					style={[
						styles.banner,
						isShared ? styles.sectionEnd : styles.cardGap,
						{ backgroundColor: theme.colors.headerSurface }
					]}
				>
					<View style={[styles.bannerBone, { backgroundColor: bannerBone, width: 92 }]} />
					<View style={[styles.bannerDivider, { backgroundColor: bannerBone }]} />
					<View style={styles.flex}>
						<View style={[styles.bannerBone, { backgroundColor: bannerBone, width: '62%' }]} />
					</View>
					<View style={[styles.chevron, { backgroundColor: bannerBone }]} />
				</CardSurface>

				{isShared ? (
					<>
						{eyebrow(t('hpGroupProgress'))}
						<CardSurface isFlush>
							<View style={styles.coverageBody}>
								<View style={styles.coverageHead}>
									<View>
										{line(26, 20, 64, 'strong')}
										<View style={styles.statLabel}>{line(14, 8, 88)}</View>
									</View>
									{line(17, 9, 72)}
								</View>
								<Bone height={6} radius={3} width='100%' />
							</View>
							{/* A few of today's readers, then yesterday's row. */}
							{[0, 1, 2].map(index => (
								<View
									key={index}
									style={[styles.linkRow, styles.hairlineTop, { borderTopColor: divider }]}
								>
									<Bone height={30} radius={15} width={30} />
									<View style={styles.flex}>
										{line(17, 9, '44%', 'strong')}
										{line(15, 8, '62%')}
									</View>
									<Bone height={22} radius={11} tone='soft' width={46} />
								</View>
							))}
							<View style={[styles.linkRow, styles.hairlineTop, { borderTopColor: divider }]}>
								<Bone height={24} radius={7} width={24} />
								<View style={styles.flex}>{line(17, 9, '64%', 'strong')}</View>
							</View>
						</CardSurface>

						{/* The rounds card: completed, this round's days, then "Tüm geçmiş". */}
						<CardSurface isFlush style={[styles.groupCardGap, styles.sectionEnd]}>
							<View style={styles.statsRow}>
								<View style={[styles.statCell, styles.statCellDivided, { borderRightColor: divider }]}>
									{line(24, 18, 28, 'strong')}
									<View style={styles.statLabel}>{line(14, 8, 90)}</View>
								</View>
								<View style={styles.statCell}>
									{line(24, 18, 56, 'strong')}
									<View style={styles.statLabel}>{line(14, 8, 104)}</View>
								</View>
							</View>
							<View style={[styles.historyRow, { borderTopColor: divider }]}>
								<View style={styles.flex}>{line(17, 9, 78)}</View>
								<Bone height={14} radius={3} tone='soft' width={8} />
							</View>
						</CardSurface>
					</>
				) : (
					<>
						{/* S6: the round on the 33. */}
						<CardSurface style={[styles.roundCard, styles.cardGap]}>
							<View style={styles.roundHead}>
								{line(19, 11, 52, 'strong')}
								{line(19, 8, 110)}
							</View>
							<CellGrid borderWidth={1.5} columns={11} gap={4} items={cells} radius={6} />
							{legend}
						</CardSurface>

						{/* Today first — unread, so "Oku" — then read days under their chip. */}
						<CardSurface isFlush>
							<View style={[styles.historyHead, { borderBottomColor: divider }]}>
								{line(19, 11, 58, 'strong')}
								{line(19, 8, 84)}
							</View>
							{Array.from({ length: HISTORY_ROWS }, (_, index) => (
								<View key={index} style={[styles.historyItem, { borderTopColor: divider }]}>
									<View style={styles.historyDate}>{line(16, 8, 40)}</View>
									<View style={styles.flex}>{line(17, 9, '70%', 'strong')}</View>
									{index === 0 ? (
										<Bone height={36} radius={11} width={52} />
									) : (
										<Bone height={27} radius={7} tone='soft' width={72} />
									)}
								</View>
							))}
							<View style={[styles.historyRow, { borderTopColor: divider }]}>
								<View style={styles.flex}>{line(17, 9, 78)}</View>
								<Bone height={14} radius={3} tone='soft' width={8} />
							</View>
						</CardSurface>

						<Bone height={54} radius={15} style={styles.deleteLink} width='100%' />
						<View style={styles.centerHint}>{line(17, 8, '78%')}</View>
					</>
				)}
			</SkeletonPulse>

			{/* The leave button — a shared group's only; an individual reading is deleted above. */}
			{isShared ? (
				<SkeletonPulse>
					<Bone height={54} radius={15} width='100%' />
				</SkeletonPulse>
			) : null}

			<SkeletonStatusRow label={t('loadingGroup')} />
		</>
	);
};

/* `HizbPlanGroup`'s styles, measure for measure. */
const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	line: { justifyContent: 'center' },
	spread: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
	titleChips: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	body: { marginTop: 6 },
	sectionEyebrow: { marginBottom: 10 },
	cardGap: { marginBottom: 10 },
	sectionEnd: { marginBottom: 22 },
	hairlineTop: { borderTopWidth: StyleSheet.hairlineWidth },
	// Today's card.
	todayBody: { padding: 16 },
	readingTitle: { marginTop: 10 },
	readingDesc: { marginTop: 3 },
	portionChips: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 9 },
	portionCount: { marginLeft: 4 },
	darkButton: { marginTop: 14 },
	footRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	// The "Senin ilerlemen" banner: a caption's 17pt line.
	banner: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
	bannerBone: { borderRadius: 4.5, height: 9, marginVertical: 4 },
	bannerDivider: { height: 11, width: 1 },
	chevron: { borderRadius: 3, height: 14, width: 8 },
	// Group progress.
	coverageBody: { paddingBottom: 14, paddingHorizontal: 16, paddingTop: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	statLabel: { marginTop: 5 },
	legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 11 },
	legendKey: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	linkRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
	// The rounds card.
	groupCardGap: { marginTop: 10 },
	statsRow: { flexDirection: 'row' },
	statCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
	statCellDivided: { borderRightWidth: StyleSheet.hairlineWidth },
	historyRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		paddingHorizontal: 16,
		paddingVertical: 11
	},
	// S6.
	roundCard: { paddingHorizontal: 16, paddingVertical: 15 },
	roundHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
	historyHead: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	historyItem: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 10
	},
	historyDate: { width: 52 },
	deleteLink: { marginBottom: 12, marginTop: 18 },
	centerHint: { alignItems: 'center' }
});
