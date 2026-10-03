import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { TitleText } from '@/components/ui/Typography/Typography.component';
import type { CachedGroupShape } from '@/lib/hooks/useCachedGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupKind } from '@/lib/types/domain';
import { partCountFor } from '@/lib/utils/groupKinds';
import { kindLabelKey } from '@/lib/utils/groups';
import { READERS_PREVIEW_ROWS } from '@/lib/utils/hizbReadersPreview';
import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

/** S6's short history: today and the four readings before it. */
const HISTORY_ROWS = 5;

/** The screen's `ROUND_COLUMNS`: the Hizb's 33 in three rows, the others ten a row. */
const ROUND_COLUMNS: Record<GroupKind, number> = { CEVSEN: 10, HATIM: 10, HIZB: 11 };

type Props = { plan: NonNullable<CachedGroupShape['plan']> };
type BoneWidth = number | `${number}%`;

/**
 * `HizbPlanGroup` before its reading answers — a shared Hizb plan's layout, or a Şahsi Hizb,
 * Cevşen or Kur'an reading's, with every measure taken from that screen's own styles. The heading
 * is the real one: the name, the chips and the subtitle are all known from the group already. So
 * are the section cards' titles and the round's cells, which are drawn as they will be, only empty.
 *
 * The state drawn is the common first load: today not read yet, so today's card with its buttons
 * (one for a Cevşen, the read and "Kitaptan okudum" pair otherwise — the app first, as for a
 * member who doesn't always read from the book). A shared group has a yesterday and more members
 * than its preview, a Şahsi reading a few days of history. Picking (S1), removed (S3), a day
 * already read (W2) and the group done (W3) can't be told from the cache and load under this.
 *
 * Returned as the container's own children, as the screen's are, so the column's gap between
 * the heading, the body and the leave button is the same one.
 */
export const HizbPlanGroupSkeleton = ({ plan }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;
	const isShared = !plan.hizbIndividual;
	const isHizb = plan.kind === 'HIZB';
	const planLabel = plan.hizbPlan ? t('hpDays', { days: plan.hizbPlan }) : t('hpMixedPlan');
	// A 7- or 15-day Hizb plan's day covers several of the 33, named as chips under the title. A
	// Cevşen or Kur'an day's babs or cüz are its title, and have none.
	const portionChipCount =
		isHizb && (plan.hizbPlan === 7 || plan.hizbPlan === 15) ? Math.ceil(33 / plan.hizbPlan) : 0;
	// The readers the preview lists — you first — and "Tümünü gör" when there are more.
	const readerRows = Math.min(Math.max(plan.memberCount, 1), READERS_PREVIEW_ROWS);
	// A round begun mid-plan says where it wraps beside its title.
	const hasRoundWrap = isHizb && plan.hizbStartPortion > 1;

	// The round's board: the Hizb's 33, a Cevşen's hundred babs or a Kur'an's thirty cüz.
	const cells = useMemo<CellGridItem[]>(
		() =>
			Array.from({ length: partCountFor(plan.kind) }, (_, index) => ({
				backgroundColor: theme.colors.segmentTrack,
				key: index + 1,
				label: index + 1,
				labelColor: theme.colors.faintText
			})),
		[plan.kind, theme]
	);

	/** A bone centred in a text line of the given height, as the text will sit. */
	const line = (lineHeight: number, height: number, width: BoneWidth, tone: 'soft' | 'strong' = 'soft') => (
		<View style={[styles.line, { height: lineHeight }]}>
			<Bone height={height} radius={height / 2} tone={tone} width={width} />
		</View>
	);

	/** A row's chevron: the glyph's stroke inside the icon's 15-point box. */
	const chevron = (
		<View style={styles.chevronBox}>
			<Bone height={14} radius={3} tone='soft' width={8} />
		</View>
	);

	/** A section card's heading, as the screen's `SectionHeading` draws it: its title, then a count. */
	const heading = (label: string, hasCount = false) => (
		<View style={[styles.sectionHeading, { borderBottomColor: divider }]}>
			<TitleText>{label}</TitleText>
			{hasCount ? line(17, 9, 36) : null}
		</View>
	);

	const legend = (
		<View style={styles.legend}>
			{[36, 42, 30].map(width => (
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
						: isHizb
						? t('hpSubtitleIndividual', { days: plan.hizbPlan, start: plan.hizbStartPortion })
						: t('spSubtitle', { days: plan.planDays ?? 0 })
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
						<Chip label={t(kindLabelKey(plan.kind))} tone='neutral' />
					</View>
				}
			/>

			<SkeletonPulse style={styles.body}>
				{/* The stats card: a shared plan's people and time left, a Şahsi reading's time left
				    alone, then the reset row — a shared plan's with the reader's own time at its end. */}
				<CardSurface isFlush style={styles.cardGap}>
					<View style={styles.clockRow}>
						{isShared ? (
							<View style={[styles.clockCell, styles.clockCellDivided, { borderRightColor: divider }]}>
								{line(28, 20, 28, 'strong')}
								<View style={styles.clockLabel}>{line(14, 8, 30)}</View>
							</View>
						) : null}
						<View style={styles.clockCell}>
							{line(28, 20, 112, 'strong')}
							<View style={styles.clockLabel}>{line(14, 8, 96)}</View>
						</View>
					</View>
					<View style={[styles.clockReset, { borderTopColor: divider }]}>
						<Bone height={15} radius={7.5} width={15} />
						{line(17, 9, isShared ? 128 : 84, 'strong')}
						{isShared ? <View style={styles.clockLocal}>{line(17, 9, 80)}</View> : null}
					</View>
				</CardSurface>

				{/* "Benim ilerlemem": one headed card around today's card and the banner. */}
				<CardSurface isFlush style={isShared ? styles.sectionEnd : styles.cardGap}>
					{heading(t('hpMyProgress'))}
					<View style={styles.sectionCardBody}>
						{/* Today's card, edge to edge: date and tag, the title, the Hizb's description or
						    chips, then its buttons — it ends on them, with no reset row of its own. */}
						<View style={styles.cardGap}>
							<View style={styles.todayBlock}>
								<View style={[styles.todayBody, styles.todayBodyLast]}>
									<View style={styles.spread}>
										{line(14, 8, 96)}
										<Bone
											height={22}
											radius={6}
											tone='soft'
											width={isShared || !isHizb ? 96 : portionChipCount > 0 ? 86 : 72}
										/>
									</View>
									<View style={styles.readingTitle}>
										{line(26.25, 15, isHizb ? '56%' : 96, 'strong')}
									</View>
									{/* A single portion has its description; a day of several has its chips instead. */}
									{isHizb && portionChipCount === 0 ? (
										<View style={styles.readingDesc}>{line(18.75, 9, '82%')}</View>
									) : null}
									{portionChipCount > 0 ? (
										<View style={styles.portionChips}>
											{Array.from({ length: portionChipCount }, (_, index) => (
												<Bone height={24} key={index} radius={7} tone='soft' width={26} />
											))}
											<View style={styles.portionCount}>{line(22, 8, 48)}</View>
										</View>
									) : null}
									{/* A Cevşen reads in the app only; a Hizb or Kur'an day adds "Kitaptan okudum". */}
									<Bone height={54} radius={15} style={styles.firstButton} width='100%' />
									{plan.kind === 'CEVSEN' ? null : (
										<Bone
											height={54}
											radius={15}
											style={styles.bookButton}
											tone='soft'
											width='100%'
										/>
									)}
								</View>
							</View>
						</View>

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
							<View style={styles.chevronBox}>
								<View style={[styles.chevron, { backgroundColor: bannerBone }]} />
							</View>
						</CardSurface>
					</View>
				</CardSurface>

				{isShared ? (
					<>
						{/* "Grup ilerlemesi": today's count and its bar, a few readers, "Tümünü gör",
						    then yesterday's row. */}
						<CardSurface isFlush>
							{heading(t('hpGroupProgress'), true)}
							<View style={styles.coverageBody}>
								<View style={styles.coverageHead}>
									<View>
										{line(26, 20, 64, 'strong')}
										<View style={styles.statLabel}>{line(14, 8, 104)}</View>
									</View>
									{line(17, 9, 32)}
								</View>
								<Bone height={6} radius={3} width='100%' />
							</View>
							{Array.from({ length: readerRows }, (_, index) => (
								<View
									key={index}
									style={[styles.linkRow, styles.hairlineTop, { borderTopColor: divider }]}
								>
									<Bone height={30} radius={15} width={30} />
									<View style={styles.flex}>
										{line(17, 9, '44%', 'strong')}
										<View style={styles.rowSub}>{line(17, 8, '62%')}</View>
									</View>
									<Bone height={25} radius={12.5} tone='soft' width={64} />
								</View>
							))}
							{plan.memberCount > readerRows ? (
								<View style={[styles.navRow, styles.hairlineTop, { borderTopColor: divider }]}>
									{line(18, 9, 72, 'strong')}
									<View style={styles.navRowEnd}>
										{line(17, 8, 64)}
										{chevron}
									</View>
								</View>
							) : null}
							<View style={[styles.linkRow, styles.hairlineTop, { borderTopColor: divider }]}>
								<Bone height={24} radius={7} width={24} />
								<View style={styles.flex}>{line(17, 9, '56%', 'strong')}</View>
							</View>
						</CardSurface>

						{/* The rounds card: completed, this round's days, then "Tüm geçmiş". */}
						<View style={styles.groupCardGap}>
							<CardSurface isFlush style={styles.sectionEnd}>
								<View style={styles.statsRow}>
									<View
										style={[styles.statCell, styles.statCellDivided, { borderRightColor: divider }]}
									>
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
									{chevron}
								</View>
							</CardSurface>
						</View>
					</>
				) : (
					<>
						{/* S6: the round on its board — the Hizb's 33, a Cevşen's 100 or a Kur'an's 30. */}
						<CardSurface style={[styles.roundCard, styles.cardGap]}>
							<View style={styles.roundHead}>
								{line(19, 11, 52, 'strong')}
								{hasRoundWrap ? line(17, 8, 150) : null}
							</View>
							<CellGrid
								borderWidth={1.5}
								columns={ROUND_COLUMNS[plan.kind]}
								gap={4}
								items={cells}
								radius={6}
							/>
							{legend}
						</CardSurface>

						{/* Today first — unread, so "Oku" — then read days under their chip. */}
						<CardSurface isFlush>
							<View style={[styles.historyHead, { borderBottomColor: divider }]}>
								{line(19, 11, 58, 'strong')}
								{line(17, 8, 84)}
							</View>
							{Array.from({ length: HISTORY_ROWS }, (_, index) => (
								<View key={index} style={[styles.historyItem, { borderTopColor: divider }]}>
									<View style={styles.historyDate}>{line(16, 8, 40)}</View>
									<View style={styles.flex}>{line(17, 9, '70%', 'strong')}</View>
									{index === 0 ? (
										<Bone height={36} radius={11} width={52} />
									) : (
										<Bone height={27} radius={7} tone='soft' width={74} />
									)}
								</View>
							))}
							<View style={[styles.historyRow, { borderTopColor: divider }]}>
								<View style={styles.flex}>{line(17, 9, 78)}</View>
								{chevron}
							</View>
						</CardSurface>

						<Bone height={54} radius={15} style={styles.deleteLink} width='100%' />
						{/* The app-only count note: the Hizb's and the Cevşen's — a Kur'an's book cüz count too. */}
						{plan.kind === 'HATIM' ? null : <View style={styles.centerHint}>{line(17, 8, '78%')}</View>}
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
	cardGap: { marginBottom: 10 },
	sectionEnd: { marginBottom: 22 },
	hairlineTop: { borderTopWidth: StyleSheet.hairlineWidth },
	chevronBox: { alignItems: 'center', height: 15, justifyContent: 'center', width: 15 },
	// The stats card: its cells and the panel `RoundResetRow`.
	clockRow: { flexDirection: 'row' },
	clockCell: { flex: 1, paddingHorizontal: 15, paddingVertical: 14 },
	clockCellDivided: { borderRightWidth: StyleSheet.hairlineWidth },
	clockLabel: { marginTop: 4 },
	clockReset: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	clockLocal: { alignItems: 'flex-end', marginLeft: 'auto' },
	// A section card: `SectionHeading`, then its body.
	sectionHeading: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	sectionCardBody: { paddingBottom: 5, paddingHorizontal: 15, paddingTop: 15 },
	// Today's card.
	todayBlock: { marginHorizontal: -15, marginTop: -15 },
	todayBody: { padding: 16 },
	todayBodyLast: { paddingBottom: 4 },
	readingTitle: { marginTop: 10 },
	readingDesc: { marginTop: 3 },
	portionChips: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
	portionCount: { marginLeft: 4 },
	firstButton: { marginTop: 14 },
	bookButton: { marginTop: 8 },
	// The "Senin ilerlemen" banner: a caption's 17pt line.
	banner: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
	bannerBone: { borderRadius: 4.5, height: 9, marginVertical: 4 },
	bannerDivider: { height: 11, width: 1 },
	chevron: { borderRadius: 3, height: 14, width: 8 },
	// Group progress.
	coverageBody: { paddingBottom: 14, paddingHorizontal: 16, paddingTop: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	statLabel: { marginTop: 5 },
	linkRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
	rowSub: { marginTop: 2 },
	// `NavRow`'s own measures: "Tümünü gör", its count and the chevron.
	navRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between', padding: 15 },
	navRowEnd: { alignItems: 'center', flexDirection: 'row', gap: 10 },
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
	legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 11 },
	legendKey: { alignItems: 'center', flexDirection: 'row', gap: 6 },
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
