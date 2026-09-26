import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupKind } from '@/lib/types/domain';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** `SpotsGrid`'s own column count, so the placeholder tiles the same way. */
const SPOT_COLUMNS = 10;
const SPOT_COUNT = 20;
/** The Hizb heading's mark — `KIND_MARK_SIZE` on the lobby. */
const KIND_MARK_SIZE = 40;

type Props = {
	/**
	 * Which lobby is loading, when the caller already knows — HC4 puts the KURUCU row above the
	 * name and the mark beside it, where the Cevşen's comes under the name. A caller that
	 * doesn't know passes CEVSEN.
	 */
	kind: GroupKind;
};

/**
 * The creator's lobby, before the group arrives.
 *
 * **This is C6, not D13.** The design's "Lobi yükleniyor" frame precedes D14 *Katıldın* —
 * it is the waiting *member's* screen, which in this app is `JoinedWelcome`. The creator's
 * lobby is a left-aligned stack of cards with a spots grid and a Başlat button, and a
 * centred spinner-led skeleton in front of it described a screen that never arrived.
 */
export const LobbySkeleton = ({ kind }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	/* KURUCU · TOPLANIYOR */
	const stateRow = (
		<View style={[styles.stateRow, kind === 'HIZB' ? styles.stateRowUnderBar : null]}>
			<Bone height={9} radius={4.5} tone='soft' width={64} />
			<Bone height={22} radius={7} width={96} />
		</View>
	);

	return (
		<View>
			<SkeletonPulse>
				{kind === 'HIZB' ? (
					<>
						{/* The state row leads and takes the band under the back button, as on
						    the screen; the name, its line and the mark follow. */}
						{stateRow}
						<View style={[styles.header, styles.hizbHeader]}>
							<View style={styles.hizbHeaderCopy}>
								<Bone height={22} radius={9} width={128} />
								<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={168} />
							</View>
							<Bone height={KIND_MARK_SIZE} radius={KIND_MARK_SIZE / 2} width={KIND_MARK_SIZE} />
						</View>
					</>
				) : (
					<>
						{/* Back row, name and the "sayım başlamadı" line. */}
						{/* No bone for a back link — that control is the navigator's, and the header
						    below already reserves the band it sits in. */}
						<View style={[styles.header, styles.headerUnderBar]}>
							<Bone height={22} radius={9} width={128} />
							<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={168} />
						</View>
						{stateRow}
					</>
				)}

				<CardSurface style={styles.fillCard}>
					<View style={styles.fillRow}>
						<Bone height={22} radius={7} width={22} />
						<Bone height={10} radius={5} tone='soft' width={86} />
						<Bone height={9} radius={4.5} style={styles.openSpots} tone='soft' width={104} />
					</View>
					<Bone height={6} radius={3} style={styles.fillBar} width='100%' />

					{/* The seats, at the grid's real 10 columns. */}
					<View style={styles.spotsGrid}>
						{Array.from({ length: SPOT_COUNT }, (_, index) => (
							<View key={index} style={styles.spotSlot}>
								<Bone height={undefined} radius={4} style={styles.spotCell} />
							</View>
						))}
					</View>

					<Bone height={9} radius={4.5} style={styles.poolNote} tone='soft' width='92%' />
				</CardSurface>

				<CardSurface isFlush style={styles.inviteCard}>
					<View style={[styles.inviteBlock, { borderBottomColor: theme.colors.border }]}>
						<Bone height={9} radius={4.5} style={styles.inviteLabel} tone='soft' width={78} />
						<View style={styles.inviteRow}>
							<Bone height={20} radius={7} style={styles.inviteValue} />
							<Bone height={34} radius={11} width={112} />
						</View>
					</View>
					<View style={styles.toggleRow}>
						<View style={styles.toggleCopy}>
							<Bone height={12} radius={5} width={186} />
							<Bone height={9} radius={4.5} tone='soft' width={214} />
						</View>
						<Bone height={22} radius={11} width={38} />
					</View>
				</CardSurface>

				<Bone height={52} radius={15} style={styles.startButton} width='100%' />
				<Bone height={9} radius={4.5} style={styles.startHint} tone='soft' width={236} />
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingLobby')} />
		</View>
	);
};

const styles = StyleSheet.create({
	fillBar: {
		marginBottom: 13,
		marginTop: 10
	},
	fillCard: {
		marginBottom: 11
	},
	fillRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	/*
	 * Clear of the navigator's back button, exactly as `ScreenHeader` is on the screen this
	 * stands in for. Without it the skeleton's own title bone sat under the floating control
	 * — and a stand-in that starts in a different place than the real thing defeats the point
	 * of having one.
	 */
	header: {
		paddingBottom: 16
	},
	headerUnderBar: {
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	// The heading's own 8 above the name, and the mark centred beside it as `ScreenTitle` does.
	hizbHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		paddingTop: 8
	},
	hizbHeaderCopy: {
		flex: 1
	},
	inviteBlock: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		padding: 15
	},
	inviteCard: {
		marginBottom: 11
	},
	inviteLabel: {
		marginBottom: 7
	},
	inviteRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	inviteValue: {
		flex: 1
	},
	openSpots: {
		marginLeft: 'auto'
	},
	poolNote: {
		marginTop: 12
	},
	spotCell: {
		aspectRatio: 1,
		width: '100%'
	},
	spotsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row
	// `gap` overflow and wrap a column early.
	spotSlot: {
		flexDirection: 'row',
		padding: 1.5,
		width: `${100 / SPOT_COLUMNS}%`
	},
	startButton: {
		marginTop: 2
	},
	startHint: {
		alignSelf: 'center',
		marginTop: 11
	},
	stateRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	// The screen's `stateRowUnderBar`: clear of the bar, and 2 + the heading's 8 above the name.
	stateRowUnderBar: {
		marginBottom: 2,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	subtitle: {
		marginTop: 9
	},
	toggleCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	toggleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		padding: 15
	}
});
