import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { StyleSheet, View } from 'react-native';

/**
 * D13 · the post-join confirmation, while the group is still being read.
 *
 * The design calls that frame "Lobi yükleniyor", but it sits immediately before D14
 * *Katıldın* — the lobby it loads is the waiting **member's**, which in this app is this
 * screen. The creator's lobby is C6 and looks nothing like it; see `LobbySkeleton`.
 *
 * Centred and spinner-led: this is a moment of arrival rather than a page of content, so a
 * column of bones down the left would misrepresent what is coming. The range card is the one
 * thing the reader is actually waiting to see.
 */
export const JoinedWelcomeSkeleton = () => {
	const { t } = useTranslation();

	return (
		<View style={styles.root}>
			<View style={styles.top}>
				<SkeletonSpinner size={66} thickness={3} />

				<Bone height={22} radius={9} style={styles.title} width={196} />
				<View style={styles.subtitle}>
					<Bone height={8} radius={4} tone='soft' width={236} />
					<Bone height={8} radius={4} tone='soft' width={168} />
				</View>

				<CardSurface style={styles.rangeCard}>
					<Bone height={8} radius={4} tone='soft' width={78} />
					<Bone height={34} radius={11} width={124} />
					<Bone height={8} radius={4} tone='soft' width={144} />
				</CardSurface>
			</View>

			<View style={styles.footer}>
				<Bone height={52} radius={15} width='100%' />
				<Bone height={44} radius={14} tone='soft' width='100%' />
				<SkeletonStatusRow label={t('loadingJoined')} />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	footer: {
		gap: 10
	},
	rangeCard: {
		alignItems: 'center',
		alignSelf: 'stretch',
		gap: 12,
		marginTop: 26,
		paddingVertical: 22
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
	/*
	 * The 64 `JoinedWelcomeScreen`'s own hero uses, so nothing shifts when the bones are
	 * replaced — it was 58, which was close enough to look deliberate and moved the check
	 * circle six points as the screen arrived. It also clears the navigator's back button,
	 * which this screen gained when its "Geri" link was removed.
	 */
	top: {
		alignItems: 'center',
		paddingTop: 64
	}
});
