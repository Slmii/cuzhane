import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/**
 * D13 · Lobi yükleniyor.
 *
 * The lobby is a waiting screen either way, so its skeleton leads with the spinner rather
 * than burying it: a 66pt ring above the heading, then the invite-code card and the members
 * line beneath. As on Home the bones themselves stay still — the ring carries the motion.
 */
export const LobbySkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={styles.root}>
			<View style={styles.top}>
				<SkeletonSpinner size={66} thickness={3} />

				<Bone height={20} radius={9} style={styles.title} width={214} />
				<View style={styles.subtitle}>
					<Bone height={8} radius={4} tone='soft' width={244} />
					<Bone height={8} radius={4} tone='soft' width={176} />
				</View>

				{/* The invite-code card — the one thing this screen exists to show. */}
				<CardSurface style={[styles.codeCard, { borderColor: theme.colors.accent }]}>
					<Bone height={8} radius={4} tone='soft' width={74} />
					<Bone height={32} radius={10} width={132} />
					<Bone height={26} radius={9} tone='soft' width={112} />
				</CardSurface>

				<CardSurface style={styles.membersCard}>
					<Bone height={7} radius={4} width='100%' />
					<View style={styles.membersRow}>
						<Bone height={8} radius={4} tone='soft' width={104} />
						<Bone height={8} radius={4} tone='soft' width={72} />
					</View>
				</CardSurface>
			</View>

			<View style={styles.footer}>
				<Bone height={52} radius={15} width='100%' />
				<View style={styles.footerCaption}>
					<Bone height={8} radius={4} tone='soft' width={118} />
				</View>
				<SkeletonStatusRow label={t('loadingLobby')} />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	codeCard: {
		alignItems: 'flex-start',
		alignSelf: 'stretch',
		borderWidth: 1,
		gap: 13,
		marginTop: 26,
		padding: 22
	},
	footer: {
		gap: 10,
		marginTop: 22
	},
	footerCaption: {
		alignItems: 'center'
	},
	membersCard: {
		alignSelf: 'stretch',
		marginTop: 11,
		padding: 16
	},
	membersRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		marginTop: 10
	},
	root: {
		flex: 1,
		justifyContent: 'space-between',
		paddingBottom: 30
	},
	subtitle: {
		alignItems: 'center',
		gap: 8,
		marginTop: 12
	},
	title: {
		marginTop: 22
	},
	top: {
		alignItems: 'center',
		paddingTop: 58
	}
});
