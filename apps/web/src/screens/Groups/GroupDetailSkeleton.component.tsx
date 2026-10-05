import { HizbBoardSkeleton } from '@/components/HizbBoard/HizbBoardSkeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupKind } from '@/lib/types/domain';
import { unitCountFor } from '@/lib/utils/units';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** `BabGrid`'s ten across, as on the screen. */
const BOARD_COLUMNS = 10;
/** `BabGrid`'s gap between cells, and its cells' radius. */
const BOARD_GAP = 4;
const BOARD_CELL_RADIUS = 6;
/**
 * `BabLegend`'s five Cevşen keys, each bone about as wide as its Turkish label at 10.5pt — "sen
 * okudun", "senin", "başkaları okudu", "başkasında", "havuz" — so the legend wraps where it will.
 */
const BAB_LEGEND_LABEL_WIDTHS = [52, 28, 76, 52, 30];
/** HZ1's open panel shows a share of two; the bones do the same. */
const HIZB_ROW_COUNT = 2;

type Props = {
	/**
	 * Which book's screen this stands in for — seeded from the shelf, the Cevşen's without one.
	 * A hatim has its own stand-in (`HatimGroupSkeleton`); this one draws the Cevşen and the Hizb.
	 */
	kind?: Exclude<GroupKind, 'HATIM'>;
};

/**
 * D15 · Grup yükleniyor — üye görünümü.
 *
 * What the group screen draws for a running Cevşen group, in its order: the heading with its
 * cadence and kind chips over the dedication, the countdown card, then two headed cards. "Benim
 * ilerlemem" holds the share panel — closed, as the screen opens it, ringed in the accent — and the
 * slim "Senin ilerlemen" banner under it. "Grubun ilerlemesi" holds the "Geçen tur" row on the
 * page's own colour and then the hundred, bare inside the card as the screen draws it.
 *
 * **No "Başladı" box.** The screen shows it only for a share begun and not yet finished; at the
 * start of a round nothing is begun, and once the share is read it goes again, so a page opened
 * to go and read — or opened after reading — has none. A bone for it would be wrong more often
 * than right.
 *
 * The share panel's header keeps its sage and tints its own bones out of the accent, and the
 * banner keeps its green, exactly as the frame does: those are the colour on the screen, and a
 * grey placeholder there would have the page appear to change colour when the data lands rather
 * than simply fill in.
 *
 * A Hizb group (HZ1) differs where its screen does: the heading carries the round line and the
 * book's mark at the right, the share panel is `HizbSharePanel` (a works line under its label,
 * rows with a two-line description), "Grubun ilerlemesi" is a small-caps label over loose cards
 * rather than a card, and the board is the 32 portions' own frame (`HizbBoardSkeleton`).
 */
export const GroupDetailSkeleton = ({ kind = 'CEVSEN' }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;
	const isHizb = kind === 'HIZB';
	const accentInk = (alpha: number) => ({ backgroundColor: toAlphaColor(theme.colors.accent, alpha) });
	const bannerInk = { backgroundColor: toAlphaColor(theme.colors.onHeaderSurface, 0.22) };

	/** `ProgressSection`'s card: title and count on the surface, a hairline, then a padded body. */
	const sectionCard = (titleWidth: number, countWidth: number, body: ReactNode) => (
		<CardSurface isFlush>
			<View style={[styles.sectionHeader, { borderBottomColor: divider }]}>
				<View style={styles.titleLine}>
					<Bone height={12} radius={6} width={titleWidth} />
				</View>
				<View style={styles.captionLine}>
					<Bone height={9} radius={4.5} tone='soft' width={countWidth} />
				</View>
			</View>
			<View style={styles.sectionBody}>{body}</View>
		</CardSurface>
	);

	/*
	 * The row "Geçen tur" and "Havuz" share: a 40pt tile, two caption lines, a chevron. Inside the
	 * Cevşen's section card it is a flat card on the page's colour; the Hizb's sits loose, in glass.
	 */
	const roundRow = (
		<CardSurface
			hasGlassSurface={isHizb}
			style={[styles.rowCard, isHizb ? null : { backgroundColor: theme.colors.background }]}
		>
			<Bone height={40} radius={13} width={40} />
			<View style={styles.rowCopy}>
				<View style={styles.captionLine}>
					<Bone height={9} radius={4.5} width='58%' />
				</View>
				<View style={[styles.captionLine, styles.rowSub]}>
					<Bone height={8} radius={4} tone='soft' width='74%' />
				</View>
			</View>
			<Bone height={14} radius={3} tone='soft' width={8} />
		</CardSurface>
	);

	/*
	 * The share panel as the screen first draws it. A Cevşen's starts closed: the sage header alone,
	 * the whole card in its colour, no glass and no hairline. A Hizb's `HizbSharePanel` is open: the
	 * header over its rows, ringed in the accent at 2pt and in glass.
	 */
	const sharePanel = (
		<CardSurface
			hasGlassSurface={isHizb}
			isFlush
			style={{
				borderColor: theme.colors.accent,
				borderWidth: 2,
				...(isHizb ? null : { backgroundColor: theme.colors.accentSoft })
			}}
		>
			<View
				style={[
					styles.shareHeader,
					{
						backgroundColor: theme.colors.accentSoft,
						borderBottomColor: divider,
						...(isHizb ? null : { borderBottomWidth: 0 })
					}
				]}
			>
				{/* A slice such as "21–25" — wider than the real badge's 38pt minimum, which only "1–5" fits. */}
				<View style={[styles.shareBadge, accentInk(0.22)]} />
				{isHizb ? (
					// The label over the works the share falls in, 3 apart.
					<View style={styles.hizbShareCopy}>
						<View style={styles.statLine}>
							<View style={[styles.shareLabel, accentInk(0.18)]} />
						</View>
						<View style={styles.captionLine}>
							<View style={[styles.shareWorks, accentInk(0.12)]} />
						</View>
					</View>
				) : (
					<View style={styles.shareCopy}>
						<View style={styles.statLine}>
							<View style={[styles.shareLabel, accentInk(0.18)]} />
						</View>
					</View>
				)}
				{/* The done count, then the chevron's 15. */}
				<View style={styles.shareMeta}>
					<View style={styles.captionLine}>
						<View style={[isHizb ? styles.hizbShareCount : styles.shareCount, accentInk(0.18)]} />
					</View>
					<View style={[styles.shareChevron, accentInk(0.14)]} />
				</View>
			</View>
			{isHizb ? (
				<View>
					{Array.from({ length: HIZB_ROW_COUNT }, (_, index) => (
						// `BabRow`: the checkbox, a title over its line or two, and "Oku".
						<View key={index} style={[styles.shareRow, { borderBottomColor: divider }]}>
							<Bone height={26} radius={9} width={26} />
							<View style={styles.shareRowCopy}>
								<View style={styles.rowTitleLine}>
									<Bone height={9} radius={4.5} width='64%' />
								</View>
								{/* A Hizb portion's description runs to two lines. */}
								<View>
									<View style={styles.captionLine}>
										<Bone height={8} radius={4} tone='soft' width='92%' />
									</View>
									<View style={styles.captionLine}>
										<Bone height={8} radius={4} tone='soft' width='56%' />
									</View>
								</View>
							</View>
							<Bone height={36} radius={11} tone='soft' width={52} />
						</View>
					))}
				</View>
			) : null}
		</CardSurface>
	);

	/*
	 * "Senin ilerlemen" at the banner's own metrics — its caption's 17 line in 13 of padding — and
	 * in the header's green, its bones in the header's ink: the title, the run of numbers, the
	 * chevron.
	 */
	const progressBanner = (
		<CardSurface hasGlassSurface={false} style={[styles.banner, { backgroundColor: theme.colors.headerSurface }]}>
			<View style={styles.captionLine}>
				<View style={[styles.bannerTitle, bannerInk]} />
			</View>
			<View style={[styles.bannerStats, bannerInk]} />
			<View style={[styles.bannerChevron, bannerInk]} />
		</CardSurface>
	);

	const myProgressBody = (
		<>
			{sharePanel}
			{progressBanner}
		</>
	);

	return (
		<View style={styles.root}>
			<SkeletonPulse style={styles.stack}>
				{/*
				 * `ScreenHeader` under the bar: no eyebrow row, the title's 31pt line with its chips
				 * beside it, and the caption 3 under. The Cevşen's caption is the dedication, which a
				 * group nearly always has; the Hizb's is the round line, then the dedication on a
				 * second line, with the book's mark centred against the block. No square for the
				 * corner actions, which are toolbar items in the navigator's bar.
				 */}
				<View style={styles.header}>
					<View style={styles.headerCopy}>
						<View style={styles.headerTitleRow}>
							<Bone height={22} radius={9} width={150} />
							<View style={styles.headerChips}>
								<Bone height={22} radius={6} tone='soft' width={64} />
								{isHizb ? null : <Bone height={22} radius={6} tone='soft' width={56} />}
							</View>
						</View>
						<View style={[styles.captionLine, styles.headerCaption]}>
							<Bone height={9} radius={4.5} tone='soft' width={isHizb ? 112 : 132} />
						</View>
						{isHizb ? (
							<View style={styles.captionLine}>
								<Bone height={9} radius={4.5} tone='soft' width={132} />
							</View>
						) : null}
					</View>
					{isHizb ? <Bone height={44} radius={22} width={44} /> : null}
				</View>

				{/* Two stat cells 8 apart, the first with a hairline at its right, then the reset line. */}
				<CardSurface isFlush>
					<View style={styles.statsRow}>
						<View
							style={[
								styles.statCell,
								{ borderRightColor: divider, borderRightWidth: StyleSheet.hairlineWidth }
							]}
						>
							<View style={styles.numericLine}>
								<Bone height={20} radius={7} width={isHizb ? 60 : 52} />
							</View>
							<View style={[styles.statLine, styles.statLabel]}>
								<Bone height={8} radius={4} tone='soft' width={isHizb ? 72 : 32} />
							</View>
						</View>
						<View style={styles.statCell}>
							<View style={styles.numericLine}>
								<Bone height={20} radius={7} width={44} />
							</View>
							<View style={[styles.statLine, styles.statLabel]}>
								<Bone height={8} radius={4} tone='soft' width={isHizb ? 64 : 32} />
							</View>
						</View>
					</View>
					{/* `RoundResetRow`'s panel: the 15pt clock, the group's time, the local one at the right. */}
					<View style={[styles.resetRow, { borderTopColor: divider }]}>
						<Bone height={15} radius={7.5} width={15} />
						<View style={styles.captionLine}>
							<Bone height={9} radius={4.5} tone='soft' width={96} />
						</View>
						<View style={[styles.captionLine, styles.resetTrailing]}>
							<Bone height={8} radius={4} tone='soft' width={78} />
						</View>
					</View>
				</CardSurface>

				{/* "Benim ilerlemem": a headed card for both kinds. */}
				{sectionCard(130, 30, myProgressBody)}

				{isHizb ? (
					<>
						{/* The Hizb's "Grubun ilerlemesi" is a small-caps label, 10 above and 2 drawn back below. */}
						<View style={[styles.eyebrowLine, styles.sectionEyebrow]}>
							<Bone height={8} radius={4} tone='soft' width={118} />
						</View>
						{roundRow}
					</>
				) : (
					sectionCard(
						146,
						44,
						<>
							{roundRow}
							{/*
							 * The hundred, bare in the card as the screen draws it: `BabGrid`'s ten across
							 * 4 apart — each slot padded by half the gap, the lattice drawn back by the same
							 * half, which sizes the cells exactly as the measured grid does — then
							 * `BabLegend` 12 under it.
							 */}
							<View style={styles.board}>
								{Array.from(
									{ length: Math.ceil(unitCountFor('CEVSEN') / BOARD_COLUMNS) },
									(_, rowIndex) => (
										<View key={rowIndex} style={styles.boardRow}>
											{Array.from({ length: BOARD_COLUMNS }, (_, cellIndex) => (
												<View key={cellIndex} style={styles.boardSlot}>
													{/* Square by aspect, as `CellGrid`'s own first pass: a `Bone` takes a fixed height. */}
													<View
														style={[
															styles.boardCell,
															{ backgroundColor: theme.colors.secondary }
														]}
													/>
												</View>
											))}
										</View>
									)
								)}
							</View>
							<View style={styles.legend}>
								{BAB_LEGEND_LABEL_WIDTHS.map((width, index) => (
									<View key={index} style={styles.legendEntry}>
										<Bone height={11} radius={3} width={11} />
										<Bone height={8} radius={4} tone='soft' width={width} />
									</View>
								))}
							</View>
						</>
					)
				)}
			</SkeletonPulse>

			{/* The 32 portions' own frame, loose under the rows as on the screen. It pulses itself. */}
			{isHizb ? <HizbBoardSkeleton /> : null}

			<SkeletonStatusRow label={t('loadingGroup')} />
		</View>
	);
};

const styles = StyleSheet.create({
	// `MyProgressCard`'s banner: 10 between its pieces, 16 across and 13 down.
	banner: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	bannerChevron: {
		borderRadius: 3,
		height: 14,
		width: 8
	},
	bannerStats: {
		borderRadius: 5,
		flex: 1,
		height: 10,
		minWidth: 0
	},
	bannerTitle: {
		borderRadius: 5,
		height: 11,
		width: 92
	},
	// The lattice drawn back by half a gap all round, so the padded slots' outer halves cancel.
	board: {
		margin: -BOARD_GAP / 2
	},
	boardCell: {
		aspectRatio: 1,
		borderRadius: BOARD_CELL_RADIUS,
		width: '100%'
	},
	boardRow: {
		flexDirection: 'row'
	},
	boardSlot: {
		flex: 1,
		padding: BOARD_GAP / 2
	},
	// `CaptionText`'s 17 line, so a bone takes the height of the text it stands in for.
	captionLine: {
		height: 17,
		justifyContent: 'center'
	},
	// `EyebrowText`'s 14 line.
	eyebrowLine: {
		height: 14,
		justifyContent: 'center'
	},
	// `ScreenTitle` under the navigator's bar: 52 above, 18 below, the action 14 from the copy.
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	headerCaption: {
		marginTop: 3
	},
	// The screen's `titleChips`: the cadence and the kind, 6 apart.
	headerChips: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	headerCopy: {
		flex: 1,
		minWidth: 0
	},
	// `Header1`'s 31 line, the chips 9 after the name.
	headerTitleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		height: 31
	},
	hizbShareCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	// "0/2".
	hizbShareCount: {
		borderRadius: 4.5,
		height: 9,
		width: 24
	},
	// `BabLegend`: 14 across, 6 between wrapped lines, 12 under the board (the body's gap).
	legend: {
		columnGap: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		rowGap: 6
	},
	// A swatch and its 10.5pt caption, on the caption's 17 line.
	legendEntry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
		height: 17
	},
	// `NumericText`'s 28 line.
	numericLine: {
		height: 28,
		justifyContent: 'center'
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
		minWidth: 0
	},
	rowSub: {
		marginTop: 2
	},
	// `BodyStrongText`'s 18 line.
	rowTitleLine: {
		height: 18,
		justifyContent: 'center'
	},
	sectionBody: {
		gap: 12,
		padding: 15
	},
	// The screen's `sectionEyebrow`: 22 above it and 10 under, out of the column's 12.
	sectionEyebrow: {
		marginBottom: -2,
		marginTop: 10
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
	shareBadge: {
		borderRadius: 12,
		height: 38,
		width: 48
	},
	shareChevron: {
		borderRadius: 3,
		height: 14,
		width: 8
	},
	shareCopy: {
		flex: 1,
		minWidth: 0
	},
	// "0 / 5 tamam".
	shareCount: {
		borderRadius: 4.5,
		height: 9,
		width: 62
	},
	shareHeader: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	// "SANA ATANAN" / "BU TUR BÖLÜMÜN" at the stat size, tracked out.
	shareLabel: {
		borderRadius: 3.5,
		height: 7,
		width: 84
	},
	shareMeta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9
	},
	// `BabRow`: 16 in at the left, 13 down, 13 between its pieces; the hairline under every row.
	shareRow: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	shareRowCopy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	shareWorks: {
		borderRadius: 4,
		height: 8,
		width: '70%'
	},
	stack: {
		gap: 12
	},
	// The real cell: a 28pt numeral over a 14pt label 4 below it, in 14 of padding.
	statCell: {
		flex: 1,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	statLabel: {
		marginTop: 4
	},
	// `StatText`'s 14 line.
	statLine: {
		height: 14,
		justifyContent: 'center'
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8
	},
	// `TitleText`'s 22 line.
	titleLine: {
		height: 22,
		justifyContent: 'center'
	}
});
