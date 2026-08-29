import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

const AVATAR_SIZE = 38;
/** Enough rows to fill the sheet's 75% detent without implying a specific group size. */
const ROW_COUNT = 6;

/**
 * The members sheet, before the list arrives.
 *
 * Rows are flat against the sheet rather than carded, matching the real list — and the
 * avatars are circles at their true diameter, which is what makes a column of bones read as
 * people rather than as paragraphs.
 */
export const MembersSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View>
			<SkeletonPulse>
				{Array.from({ length: ROW_COUNT }, (_, index) => (
					<View
						key={index}
						style={[
							styles.row,
							index === 0 ? null : { borderTopColor: theme.colors.divider, borderTopWidth: 1 }
						]}
					>
						<View style={[styles.avatar, { backgroundColor: theme.colors.secondary }]} />
						<View style={styles.copy}>
							<Bone height={12} radius={5} width={index % 2 === 0 ? 132 : 108} />
							<Bone height={8} radius={4} tone='soft' width={index % 3 === 0 ? 94 : 76} />
						</View>
						<Bone height={9} radius={4.5} tone='soft' width={46} />
					</View>
				))}
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingMembers')} />
		</View>
	);
};

const styles = StyleSheet.create({
	avatar: {
		borderRadius: AVATAR_SIZE / 2,
		height: AVATAR_SIZE,
		width: AVATAR_SIZE
	},
	copy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingVertical: 13
	}
});
