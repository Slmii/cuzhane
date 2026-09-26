import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { HOME_HEADER_AVATAR_ROOM } from './HomeHeader.component';
import { HomeFooterLinks } from './HomeFooterLinks.component';
import { HomeTopCard } from './HomeTopCard.component';

const SHEET_RADIUS = 32;
/** "Sonra"'s two rows — enough to say rows are coming without promising how many. */
const ROW_COUNT = 2;
const DAY_COUNT = 7;

/**
 * **B8L / B8Ld — Ana sayfa while it waits.** B8's own furniture in B8's places: the band with the
 * greeting, the day's line and the compact streak; the "Sıradaki" card; the sheet with "Sonra"
 * and two rows; and the ways to read outside a group, which are real links — they need nothing
 * that is loading.
 *
 * The band is drawn for real, its text stubbed in its own ink at low opacity rather than the
 * skeleton tone, which is mixed for paper. The account disc is the navigator's and is already
 * there, so it has no bone. The card's coloured bones keep their colours — the eyebrow and the
 * mark in the accent, the badge in the deadline's warmth — so the card fills in rather than
 * changing colour. Dark (B8Ld) is the same drawing in the dark theme's tokens.
 *
 * **One pulse for the whole screen, not one per bone** (`SkeletonPulse`): the design staggers
 * every placeholder, which is twenty-odd mappers on the screen that shows while the app is busy.
 * The status line and the links stay outside it — they are real.
 */
export const HomeSkeleton = () => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const tabBarHeight = useContext(TabBarOffsetContext);
	const onHeader = theme.colors.onHeaderSurface;
	const accentTint = toAlphaColor(theme.colors.accent, 0.18);

	return (
		<View style={[styles.screen, { backgroundColor: theme.colors.headerSurface }]}>
			<SkeletonPulse>
				<View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
					<View style={styles.greeting}>
						<View style={[styles.greetingBone, { backgroundColor: toAlphaColor(onHeader, 0.26) }]} />
						<View style={[styles.titleBone, { backgroundColor: toAlphaColor(onHeader, 0.34) }]} />
					</View>
					<View style={styles.streak}>
						<View style={[styles.streakBone, { backgroundColor: toAlphaColor(onHeader, 0.26) }]} />
						<View style={styles.week}>
							{Array.from({ length: DAY_COUNT }, (_, index) => (
								<View
									key={index}
									style={[styles.pill, { backgroundColor: toAlphaColor(onHeader, 0.2) }]}
								/>
							))}
						</View>
					</View>
				</View>

				<View style={styles.topCard}>
					<HomeTopCard>
						<View style={styles.cardTopRow}>
							<View style={[styles.eyebrowBone, { backgroundColor: accentTint }]} />
							<View style={[styles.badgeBone, { backgroundColor: theme.colors.deadline }]} />
						</View>
						<View style={styles.subject}>
							<View style={[styles.markBone, { backgroundColor: accentTint }]} />
							<View style={styles.subjectCopy}>
								<Bone height={20} radius={7} width={112} />
								<Bone height={9} radius={4.5} tone='soft' width={150} />
							</View>
						</View>
						<View style={[styles.bar, { backgroundColor: theme.colors.track }]} />
						<Bone height={44} radius={12} width='100%' />
					</HomeTopCard>
				</View>
			</SkeletonPulse>

			<View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
				<View style={[styles.sheetContent, { paddingBottom: tabBarHeight + 22 }]}>
					<SkeletonPulse style={styles.sheetBones}>
						<View style={styles.sectionHead}>
							<Bone height={11} radius={5.5} width={52} />
							<Bone height={8} radius={4} tone='soft' width={96} />
						</View>
						{Array.from({ length: ROW_COUNT }, (_, index) => (
							<CardSurface key={index} style={styles.row}>
								<View style={[styles.rowMark, { backgroundColor: accentTint }]} />
								<View style={styles.rowCopy}>
									<View style={styles.rowTitle}>
										<View style={[styles.rowRangeBone, { backgroundColor: accentTint }]} />
										<Bone height={10} radius={5} width={92} />
									</View>
									<View style={[styles.bar, { backgroundColor: theme.colors.track }]} />
								</View>
								<Bone height={32} radius={10} tone='soft' width={58} />
							</CardSurface>
						))}
					</SkeletonPulse>
					<SkeletonStatusRow label={t('loadingHome')} />
					<HomeFooterLinks />
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	badgeBone: {
		borderRadius: 9,
		height: 18,
		width: 84
	},
	bar: {
		borderRadius: 2.5,
		height: 5,
		width: '100%'
	},
	cardTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	eyebrowBone: {
		borderRadius: 4,
		height: 8,
		width: 58
	},
	greeting: {
		flex: 1,
		gap: 8
	},
	greetingBone: {
		borderRadius: 5,
		height: 10,
		width: 86
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingBottom: 14,
		paddingLeft: 22,
		paddingRight: 22 + HOME_HEADER_AVATAR_ROOM
	},
	markBone: {
		borderRadius: 9,
		height: 30,
		width: 30
	},
	pill: {
		borderRadius: 3,
		height: 14,
		width: 6
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	rowCopy: {
		flex: 1,
		gap: 9,
		minWidth: 0
	},
	rowMark: {
		borderRadius: 7,
		height: 22,
		width: 22
	},
	rowRangeBone: {
		borderRadius: 6,
		height: 12,
		width: 34
	},
	rowTitle: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	screen: {
		flex: 1
	},
	sectionHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 3,
		paddingHorizontal: 3,
		paddingTop: 2
	},
	sheet: {
		borderTopLeftRadius: SHEET_RADIUS,
		borderTopRightRadius: SHEET_RADIUS,
		flex: 1,
		overflow: 'hidden'
	},
	sheetBones: {
		gap: 9
	},
	// A column the height of the sheet, so the links' `marginTop: 'auto'` reaches its foot.
	sheetContent: {
		flex: 1,
		paddingHorizontal: 17,
		paddingTop: 18
	},
	streak: {
		alignItems: 'flex-end',
		gap: 5
	},
	streakBone: {
		borderRadius: 4.5,
		height: 9,
		width: 38
	},
	subject: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	subjectCopy: {
		flex: 1,
		gap: 8
	},
	titleBone: {
		borderRadius: 7,
		height: 19,
		width: 150
	},
	topCard: {
		paddingBottom: 18,
		paddingHorizontal: 17
	},
	week: {
		flexDirection: 'row',
		gap: 3
	}
});
