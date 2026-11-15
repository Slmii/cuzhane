import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** The status card's 52pt ring. */
const RING_SIZE = 52;
/** An `lg` button — "Okudum" in the card and "Uygulamada oku" under it. */
const BUTTON_HEIGHT = 54;
/** The sura number's 30pt column. */
const SURA_NUMBER_WIDTH = 30;

type CuzDetailSkeletonProps = {
	/** How many suras the cüz spans — bundled, so the list can be the right length already. */
	suraCount: number;
};

/**
 * Q4l · Cüz takibi yükleniyor — below the screen's own header, which is known before the
 * data (the cüz, its span and its page count are all bundled) and stays drawn.
 *
 * **Our Q4, not the frame's.** The frame loads under a centred ring with a line or two, a
 * three-row card and one wide bar. The screen is a status card — the ring beside its two lines,
 * then the mark button — with "Uygulamada oku" under it, then the sura contents and the note.
 * Its "Devret" half is gone, so there is no second action to stub. The contents list is drawn
 * at the cüz's real sura count, which is known here, so it lands at its final height.
 *
 * The mark button is drawn although only the holder gets one: this screen is reached from your
 * own cüz's row almost always, and a card that grows a button on arrival shifts everything
 * under it.
 */
export const CuzDetailSkeleton = ({ suraCount }: CuzDetailSkeletonProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<>
			<SkeletonPulse style={styles.stack}>
				<CardSurface style={styles.statusCard}>
					<View style={styles.statusRow}>
						<Bone height={RING_SIZE} radius={RING_SIZE / 2} width={RING_SIZE} />
						<View style={styles.statusCopy}>
							<Bone height={11} radius={5} style={styles.statusTitle} width='46%' />
							<Bone height={8} radius={4} style={styles.statusSub} tone='soft' width='72%' />
						</View>
					</View>
					<Bone height={BUTTON_HEIGHT} radius={15} width='100%' />
				</CardSurface>

				<Bone height={BUTTON_HEIGHT} radius={15} style={styles.action} width='100%' />

				<Bone height={8} radius={4} style={styles.contentsLabel} tone='soft' width={104} />
				<CardSurface isFlush>
					{Array.from({ length: suraCount }, (_, index) => (
						<View
							key={index}
							style={[
								styles.suraRow,
								index < suraCount - 1
									? {
											borderBottomColor: theme.colors.divider,
											borderBottomWidth: StyleSheet.hairlineWidth
									  }
									: null
							]}
						>
							<View style={styles.suraNumber}>
								<Bone height={8} radius={4} tone='soft' width={16} />
							</View>
							<View style={styles.suraName}>
								<Bone height={10} radius={5} width='48%' />
							</View>
							<Bone height={8} radius={4} tone='soft' width={40} />
						</View>
					))}
				</CardSurface>

				<View style={styles.note}>
					<Bone height={8} radius={4} tone='soft' width='94%' />
					<Bone height={8} radius={4} tone='soft' width='58%' />
				</View>
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingCuz')} />
		</>
	);
};

const styles = StyleSheet.create({
	// The real button's 10 under the card.
	action: {
		marginTop: 10
	},
	// The label's own 20 above, centred in its 15pt line.
	contentsLabel: {
		marginBottom: 3.5,
		marginTop: 23.5
	},
	// Two caption lines (17pt each), bones centred in them.
	note: {
		gap: 9,
		paddingVertical: 4.5
	},
	stack: {
		gap: 12
	},
	// `CuzDetailScreen`'s `statusCard`.
	statusCard: {
		gap: 14,
		paddingHorizontal: 16,
		paddingVertical: 18
	},
	statusCopy: {
		flex: 1,
		minWidth: 0
	},
	statusRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	// The caption's 17pt line under a 2pt gap.
	statusSub: {
		marginBottom: 4.5,
		marginTop: 6.5
	},
	// Centred in `BodyStrongText`'s 18pt line.
	statusTitle: {
		marginVertical: 3.5
	},
	suraName: {
		flex: 1
	},
	suraNumber: {
		width: SURA_NUMBER_WIDTH
	},
	// `CuzDetailScreen`'s `suraRow`; the name's 18pt line sets its height.
	suraRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		minHeight: 42,
		paddingHorizontal: 15,
		paddingVertical: 12
	}
});
