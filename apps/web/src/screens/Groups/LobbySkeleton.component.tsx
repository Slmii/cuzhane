import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import type { GroupKind } from '@/lib/types/domain';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** `SpotsGrid`'s own column count and gap, so the placeholder tiles the same way. */
const SPOT_COLUMNS = 10;
const SPOT_GAP = 3;
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

/** `InviteQr`'s plate: the 200pt code and its 5pt of padding on each side. */
const QR_PLATE_SIZE = 210;
/** The joined row's stack — five 30pt faces, each overlapping the last by a third. */
const AVATAR_SIZE = 30;
const AVATAR_COUNT = 5;

/**
 * The invite card both lobbies share — the code and its button, the QR, who has joined, and the
 * auto-start switch. Nothing on it depends on how the group divides its reading, so the Cevşen
 * and the Kur'an lobby skeletons draw the same one rather than two copies that could drift.
 */
export const LobbyInviteSkeleton = () => {
	const { theme } = useThemeContext();

	return (
		<CardSurface isFlush>
			<View style={[styles.inviteBlock, { borderBottomColor: theme.colors.border }]}>
				<Bone height={9} radius={4.5} style={styles.inviteLabel} tone='soft' width={78} />
				<View style={styles.inviteRow}>
					<Bone height={20} radius={7} style={styles.inviteValue} />
					<Bone height={36} radius={11} width={112} />
				</View>
				{/* The plate, its eyebrow and the two-line hint under it. */}
				<View style={styles.qr}>
					<Bone height={QR_PLATE_SIZE} radius={18} tone='soft' width={QR_PLATE_SIZE} />
					<Bone height={9} radius={4.5} style={styles.qrLabel} width={96} />
					<Bone height={9} radius={4.5} tone='soft' width={220} />
					<Bone height={9} radius={4.5} tone='soft' width={160} />
				</View>
			</View>
			<View style={[styles.joinedRow, { borderBottomColor: theme.colors.border }]}>
				<View style={styles.avatars}>
					{Array.from({ length: AVATAR_COUNT }, (_, index) => (
						<Bone
							key={index}
							height={AVATAR_SIZE}
							radius={AVATAR_SIZE / 2}
							style={index > 0 ? styles.avatarOverlap : null}
							width={AVATAR_SIZE}
						/>
					))}
				</View>
				<Bone height={9} radius={4.5} tone='soft' width={92} />
			</View>
			<View style={styles.toggleRow}>
				<View style={styles.toggleCopy}>
					<Bone height={12} radius={5} width={186} />
					<Bone height={9} radius={4.5} tone='soft' width={214} />
				</View>
				<Bone height={22} radius={11} width={38} />
			</View>
		</CardSurface>
	);
};

/**
 * The creator's lobby, before the group arrives.
 *
 * **This is C6, not D13.** The design's "Lobi yükleniyor" frame precedes D14 *Katıldın* —
 * it is the waiting *member's* screen, which in this app is `JoinedWelcome`. The creator's
 * lobby is a left-aligned stack of cards with a spots grid and a Başlat button, and a
 * centred spinner-led skeleton in front of it described a screen that never arrived.
 *
 * Spaced by the column's own 12, as `LobbyScreen` is — its cards carry no margins of their own.
 */
export const LobbySkeleton = ({ kind }: Props) => {
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
			<SkeletonPulse style={styles.stack}>
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
						<View style={styles.header}>
							<Bone height={22} radius={9} width={128} />
							<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={168} />
						</View>
						{stateRow}
					</>
				)}

				<CardSurface>
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
								{/* A plain view, not a `Bone`: its default height would override `aspectRatio`. */}
								<View style={[styles.spotCell, { backgroundColor: theme.colors.secondary }]} />
							</View>
						))}
					</View>

					{/* "Başladığında boş kalan bablar…" — two lines of caption on a phone. */}
					<View style={styles.poolNote}>
						<Bone height={9} radius={4.5} tone='soft' width='92%' />
						<Bone height={9} radius={4.5} tone='soft' width='48%' />
					</View>
				</CardSurface>

				<LobbyInviteSkeleton />

				<Bone height={54} radius={15} width='100%' />
				<Bone height={9} radius={4.5} style={styles.startHint} tone='soft' width={236} />
			</SkeletonPulse>
		</View>
	);
};

const styles = StyleSheet.create({
	avatarOverlap: {
		marginLeft: -(AVATAR_SIZE / 3)
	},
	avatars: {
		flexDirection: 'row'
	},
	fillBar: {
		marginBottom: 13,
		marginTop: 10
	},
	// The height of the count's `NumericText` line, which the bones inside it are shorter than.
	fillRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		minHeight: 28
	},
	/*
	 * Clear of the navigator's back button, exactly as `ScreenHeader` is on the screen this
	 * stands in for, with the heading block's own 18 underneath. Without the top padding the
	 * skeleton's own title bone sat under the floating control — and a stand-in that starts in a
	 * different place than the real thing defeats the point of having one.
	 */
	header: {
		paddingBottom: 18,
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
	joinedRow: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	openSpots: {
		marginLeft: 'auto'
	},
	poolNote: {
		gap: 6,
		marginTop: 12
	},
	qr: {
		alignItems: 'center',
		gap: 6,
		marginTop: 16
	},
	qrLabel: {
		marginTop: 6
	},
	spotCell: {
		aspectRatio: 1,
		borderRadius: 4,
		width: '100%'
	},
	spotsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		// The slots' padding already spaces the cells; this pulls the outer half-gap back in.
		margin: -SPOT_GAP / 2
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row
	// `gap` overflow and wrap a column early.
	spotSlot: {
		flexDirection: 'row',
		padding: SPOT_GAP / 2,
		width: `${100 / SPOT_COLUMNS}%`
	},
	/** The column's own 12 — `LobbyScreen` spaces its cards by `ScreenContainer`'s gap alone. */
	stack: {
		gap: 12
	},
	startHint: {
		alignSelf: 'center'
	},
	stateRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	// The screen's `stateRowUnderBar`: clear of the bar, and 2 + the heading's 8 above the name —
	// the stack's 12 pulled back to 2.
	stateRowUnderBar: {
		marginBottom: -10,
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
