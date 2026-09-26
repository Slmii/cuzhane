import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

const AVATAR_SIZE = 60;
/** `skHeat` — thirty days in fifteen columns, matching `ActivityHeatmap`. */
const HEATMAP_COLUMNS = 15;
const HEATMAP_DAYS = 30;
/** `skRows` — the three stat tiles. */
const STAT_COUNT = 3;
const SETTINGS_ROW_COUNT = 4;

/**
 * G2 · Profil yükleniyor.
 *
 * Avatar and name on one left-aligned line, the two name fields, three stat tiles, the
 * 30-day grid and the settings rows.
 *
 * The avatar is a circle at its real 60pt diameter: it is the one shape here that is
 * unmistakable, and getting it right is most of what makes this read as *this* screen.
 */
export const ProfileSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;

	return (
		<View>
			<View style={styles.titleRow}>
				<View style={[styles.avatar, { backgroundColor: theme.colors.secondary }]} />
				<View style={styles.titleCopy}>
					<Bone height={18} radius={8} width={156} />
					<Bone height={8} radius={4} tone='soft' width={104} />
				</View>
			</View>

			<CardSurface isFlush style={styles.card}>
				{[118, 92].map((width, index) => (
					<View
						key={width}
						style={[
							styles.nameRow,
							index === 0 ? { borderBottomColor: divider, borderBottomWidth: 1 } : null
						]}
					>
						<Bone height={9} radius={4.5} tone='soft' width={78} />
						<Bone height={11} radius={5} width={width} />
					</View>
				))}
			</CardSurface>

			<View style={styles.statsRow}>
				{Array.from({ length: STAT_COUNT }, (_, index) => (
					<CardSurface key={index} style={styles.statCard}>
						<Bone height={20} radius={7} width={44} />
						<Bone height={7} radius={3.5} tone='soft' width={62} />
					</CardSurface>
				))}
			</View>

			<CardSurface style={styles.heatmapCard}>
				<Bone height={11} radius={5} style={styles.heatmapTitle} width={112} />
				<View style={styles.heatGrid}>
					{Array.from({ length: HEATMAP_DAYS }, (_, index) => (
						<View key={index} style={styles.heatSlot}>
							{/* A plain view, not a `Bone`: its default height would override `aspectRatio`. */}
							<View style={[styles.heatCell, { backgroundColor: theme.colors.secondary }]} />
						</View>
					))}
				</View>
			</CardSurface>

			<CardSurface isFlush style={styles.card}>
				{Array.from({ length: SETTINGS_ROW_COUNT }, (_, index) => (
					<View
						key={index}
						style={[
							styles.settingsRow,
							index === SETTINGS_ROW_COUNT - 1
								? null
								: { borderBottomColor: divider, borderBottomWidth: 1 }
						]}
					>
						<Bone height={11} radius={5} width={62 + index * 12} />
						<Bone height={34} radius={10} tone='soft' width={142 - index * 8} />
					</View>
				))}
			</CardSurface>

			<SkeletonStatusRow label={t('loadingProfile')} />
		</View>
	);
};

const styles = StyleSheet.create({
	avatar: {
		borderRadius: AVATAR_SIZE / 2,
		height: AVATAR_SIZE,
		width: AVATAR_SIZE
	},
	card: {
		marginBottom: 14
	},
	heatCell: {
		aspectRatio: 1,
		borderRadius: 3,
		width: '100%'
	},
	heatGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	// Percentage slots with the gap as padding inside them: fifteen columns of a percentage
	// width plus a row `gap` overflow and wrap a column early.
	heatSlot: {
		flexDirection: 'row',
		padding: 2,
		width: `${100 / HEATMAP_COLUMNS}%`
	},
	heatmapCard: {
		marginBottom: 14,
		padding: 16
	},
	heatmapTitle: {
		marginBottom: 12
	},
	nameRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	settingsRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		padding: 15
	},
	statCard: {
		flex: 1,
		gap: 9,
		padding: 14
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 14
	},
	titleCopy: {
		gap: 8,
		minWidth: 0
	},
	titleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		paddingBottom: 18,
		// Profil sits under a bar now (back chevron or the account/search item), like the loaded heading.
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	}
});
