import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { MyProgressCardSkeleton } from '@/components/MyProgressCard/MyProgressCardSkeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { STARTED_LABEL_WIDTH } from '@/components/StartedProgress/StartedProgress.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';

/** `BabLegend`'s four keys for a hatim board — the same count the screen's own stand-in uses. */
const CUZ_LEGEND_COUNT = 4;
/** A share of two cüz — what the badge's width ("7 · 22") is drawn for too. */
const CUZ_ROW_COUNT = 2;

/**
 * Q2l · Hatim grubu yükleniyor — a Kur'an group before it arrives.
 *
 * **Our group screen, not the frame's.** A hatim opens on the same screen as a Cevşen group, so
 * this stands in for what that screen actually draws for one, in its order: the heading with its
 * kind chip, the countdown card, then the two section cards. "Benim ilerlemem" holds "Başladı",
 * the "Cüzlerin" panel — open, ringed in the accent — and "Senin ilerlemen" under it; "Grup
 * ilerlemesi" holds one row where "Geçen tur", "Havuz" and "Hatim duası" sit, then the thirty.
 * Where the frame differs from that, the screen wins:
 *
 * - **"Başladı" is in.** For a hatim the screen counts pages from the first one, so the box is up
 *   whenever the share is not all read — not only once a cüz has been begun. A share all read is
 *   the rare case; leaving the box out would have the panel drop by its height on most visits.
 * - **The thirty are ten across, not six.** The group board is `BabGrid` at its ten columns;
 *   six is the picker's map (QC4, the lobby), a different drawing.
 * - **The board is `GridSkeleton` itself, bare inside the section** — the very stand-in the screen
 *   shows there when the group has landed and the board has not, which is always the next frame:
 *   the board is only asked for once the group is in — and bare at the board's own measures, so
 *   nothing changes shape when it lands either.
 * - **One chip beside the title, the kind's.** The cadence chip only exists for a repeating
 *   hatim, and a bone for it would be a promise a one-off never keeps.
 *
 * The sage header keeps its colour and tints its bones from the accent, as `GroupDetailSkeleton`
 * does: it is the one band of colour on the page, and a grey one would read as a change of
 * colour when the data lands rather than the page filling in.
 */
export const HatimGroupSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;
	const accentInk = toAlphaColor(theme.colors.accent, 0.18);

	/** "Benim ilerlemem" / "Grup ilerlemesi": the title and the count over a hairline. */
	const sectionHeader = (titleWidth: number, countWidth: number) => (
		<View style={[styles.sectionHeader, { borderBottomColor: divider }]}>
			<Bone height={14} radius={7} style={styles.sectionTitle} width={titleWidth} />
			<Bone height={9} radius={4.5} tone='soft' width={countWidth} />
		</View>
	);

	return (
		<View style={styles.root}>
			<SkeletonPulse style={styles.stack}>
				{/* Name, the kind chip on its line, and the dedication under it. */}
				<View style={styles.header}>
					<View style={styles.headerRow}>
						<Bone height={22} radius={9} width={168} />
						<Bone height={23} radius={theme.radius.sm - 2} tone='soft' width={58} />
					</View>
					<Bone height={9} radius={4.5} style={styles.headerCaption} tone='soft' width={132} />
				</View>

				{/* Members and the countdown, then the reset line under a hairline. */}
				<CardSurface isFlush>
					<View style={styles.statsRow}>
						<View
							style={[
								styles.statCell,
								{ borderRightColor: divider, borderRightWidth: StyleSheet.hairlineWidth }
							]}
						>
							<Bone height={20} radius={7} style={styles.statValue} width={52} />
							<Bone height={8} radius={4} style={styles.statLabel} tone='soft' width={56} />
						</View>
						<View style={styles.statCell}>
							<Bone height={20} radius={7} style={styles.statValue} width={44} />
							<Bone height={8} radius={4} style={styles.statLabel} tone='soft' width={44} />
						</View>
					</View>
					<View style={[styles.resetRow, { borderTopColor: divider }]}>
						<Bone height={15} radius={7.5} width={15} />
						<Bone height={9} radius={4.5} style={styles.resetLabel} tone='soft' width={96} />
						<Bone height={8} radius={4} style={styles.resetTrailing} tone='soft' width={78} />
					</View>
				</CardSurface>

				{/* "Benim ilerlemem". */}
				<CardSurface isFlush>
					{sectionHeader(132, 30)}
					<View style={styles.sectionBody}>
						{/* "Başladı": the sand tag over the page count and its bar. */}
						<View style={[styles.started, { backgroundColor: theme.colors.background }]}>
							<View style={[styles.startedTag, { backgroundColor: theme.colors.sand }]} />
							<View style={styles.startedLine}>
								<View style={styles.startedLabel}>
									<Bone height={8} radius={4} tone='soft' width={56} />
								</View>
								<View style={[styles.startedBar, { backgroundColor: theme.colors.progressTrack }]} />
							</View>
						</View>

						{/*
						 * "Cüzlerin", open, as the screen opens it: the sage header over the share's rows.
						 * The badge is wider than the Cevşen's square because it holds the cüz themselves
						 * ("7 · 22"), and there is no slice chip beside it — a hatim's share is whole in
						 * the badge.
						 */}
						<CardSurface isFlush style={[styles.assignedPanel, { borderColor: theme.colors.accent }]}>
							<View
								style={[
									styles.assignedHeader,
									{ backgroundColor: theme.colors.accentSoft, borderBottomColor: divider }
								]}
							>
								<View
									style={[
										styles.assignedBadge,
										{ backgroundColor: toAlphaColor(theme.colors.accent, 0.22) }
									]}
								/>
								<View style={styles.assignedCopy}>
									<View style={[styles.assignedLabel, { backgroundColor: accentInk }]} />
								</View>
								<View style={styles.assignedMeta}>
									<View style={[styles.assignedCount, { backgroundColor: accentInk }]} />
									<View style={styles.chevronSlot}>
										<View style={[styles.chevron, { backgroundColor: accentInk }]} />
									</View>
								</View>
							</View>
							{/* `BabRow`: the box, the cüz and its suras, and "Oku". */}
							{Array.from({ length: CUZ_ROW_COUNT }, (_, index) => (
								<View key={index} style={[styles.cuzRow, { borderBottomColor: divider }]}>
									<Bone height={26} radius={9} width={26} />
									<View style={styles.cuzRowCopy}>
										<Bone height={10} radius={5} width='38%' />
										<Bone height={8} radius={4} tone='soft' width='72%' />
									</View>
									<Bone height={36} radius={11} tone='soft' width={52} />
								</View>
							))}
						</CardSurface>

						{/* Under the share, as on the screen. */}
						<MyProgressCardSkeleton />
					</View>
				</CardSurface>
			</SkeletonPulse>

			{/*
			 * "Grup ilerlemesi". Out of the pulse above because the board breathes on its own, and
			 * inside a second one its bones would fade twice over; the two start together, so they
			 * keep time.
			 */}
			<CardSurface isFlush>
				<SkeletonPulse>{sectionHeader(120, 40)}</SkeletonPulse>
				<View style={styles.sectionBody}>
					{/* The row shape "Geçen tur", "Havuz" and "Hatim duası" share, on the page's colour. */}
					<SkeletonPulse>
						<CardSurface
							hasGlassSurface={false}
							style={[styles.rowCard, { backgroundColor: theme.colors.background }]}
						>
							<Bone height={40} radius={13} width={40} />
							<View style={styles.rowCopy}>
								<Bone height={9} radius={4.5} width='58%' />
								<Bone height={8} radius={4} tone='soft' width='74%' />
							</View>
							<Bone height={14} radius={3} tone='soft' width={8} />
						</CardSurface>
					</SkeletonPulse>

					<GridSkeleton cellCount={CUZ_COUNT} isBare legendCount={CUZ_LEGEND_COUNT} />
				</View>
			</CardSurface>

			<SkeletonStatusRow label={t('loadingHatim')} />
		</View>
	);
};

const styles = StyleSheet.create({
	assignedBadge: {
		borderRadius: 12,
		height: 38,
		width: 52
	},
	assignedCopy: {
		flex: 1,
		minWidth: 0
	},
	// "0 / 2 bitti".
	assignedCount: {
		borderRadius: 4.5,
		height: 9,
		width: 56
	},
	assignedHeader: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	assignedLabel: {
		borderRadius: 3.5,
		height: 7,
		width: '52%'
	},
	assignedMeta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9
	},
	// Ringed in the accent, open or closed, as the screen draws it.
	assignedPanel: {
		borderWidth: 2
	},
	// The chevron, open, points up: its footprint lies on its side in the 15pt icon box.
	chevron: {
		borderRadius: 3,
		height: 8,
		width: 14
	},
	chevronSlot: {
		alignItems: 'center',
		height: 15,
		justifyContent: 'center',
		width: 15
	},
	// `BabRow`'s insets: 13 above and below, 16 at the sides, and its hairline under every row.
	cuzRow: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	// The 18pt title and the 17pt sura line under it, 2 apart: 37 tall, the row's tallest part.
	cuzRowCopy: {
		flex: 1,
		gap: 8,
		height: 37,
		justifyContent: 'center',
		minWidth: 0
	},
	/*
	 * Clear of the navigator's back button, as `ScreenHeader` is on the real screen, and its
	 * 18 of air underneath — with the column's 12 below that, the countdown card starts where
	 * the real one will.
	 */
	header: {
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	// The caption's 17pt line, 3 under the title.
	headerCaption: {
		marginBottom: 4,
		marginTop: 7
	},
	// The title's 31pt line, with the chip centred on it.
	headerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		height: 31
	},
	// The caption's 17pt line, not the 15pt clock, sets the row's height.
	resetLabel: {
		marginVertical: 4
	},
	resetRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	resetTrailing: {
		marginLeft: 'auto'
	},
	/** `ScreenContainer` spaces a column by 12; one child here, so the skeleton restores it. */
	root: {
		gap: 12
	},
	rowCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	rowCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	sectionBody: {
		gap: 12,
		padding: 15
	},
	sectionHeader: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	// The title's 22pt line.
	sectionTitle: {
		marginVertical: 4
	},
	stack: {
		gap: 12
	},
	started: {
		borderRadius: 12,
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 10
	},
	startedBar: {
		borderRadius: 2,
		flex: 1,
		height: 4
	},
	startedLabel: {
		width: STARTED_LABEL_WIDTH
	},
	// The caption's 17pt line.
	startedLine: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		height: 17
	},
	// "BAŞLADI": its 14pt line inside 3 of padding.
	startedTag: {
		borderRadius: 5,
		height: 20,
		width: 60
	},
	// The cell holds a 28pt numeral over a 14pt label, 4 apart.
	statCell: {
		flex: 1,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	statLabel: {
		marginBottom: 3,
		marginTop: 7
	},
	statValue: {
		marginVertical: 4
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8
	}
});
