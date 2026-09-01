import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** The header's progress rail — the reader's own 148×5. */
const RAIL_WIDTH = 148;
/** Lines of the passage block. The last is short, the way a paragraph ends. */
const LINE_WIDTHS = ['100%', '96%', '100%', '92%', '98%', '64%'] as const;

/**
 * The reader, before its bab arrives.
 *
 * The passage is right-aligned because the text it stands in for is Arabic — a block of
 * left-aligned bones would resolve into RTL lines and the whole column would appear to jump
 * sides. It has no design frame; this mirrors E2.
 */
export const ReaderSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={styles.root}>
			{/*
			 * **One bone, centred — the eyebrow and nothing else.** There were two, standing in
			 * for a back control on the left and the "Aa" chip on the right; both are the
			 * navigator's now, so stubbing them drew bones underneath the real controls. The real
			 * header keeps two empty side slots for centring, which is what `justifyContent`
			 * reproduces here without the extra views.
			 */}
			<View style={styles.header}>
				<Bone height={12} radius={5} width={78} />
			</View>

			<Bone height={26} radius={9} style={styles.title} width={132} />

			<View style={[styles.rail, { backgroundColor: theme.colors.switchTrackOff }]}>
				<Bone height={5} radius={3} width={54} />
			</View>

			<View style={styles.passage}>
				{LINE_WIDTHS.map((width, index) => (
					<Bone key={index} height={13} radius={5} tone={index % 2 === 0 ? 'strong' : 'soft'} width={width} />
				))}
			</View>

			<SkeletonStatusRow label={t('loadingReader')} />
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		// A navigation bar's height, matching `BabReaderScreen`'s own header row: the back
		// button is the navigator's and floats in this band, so the stand-in has to leave the
		// same room the real screen does.
		minHeight: 44,
		paddingTop: 8
	},
	passage: {
		// Right-aligned: the passage underneath is Arabic.
		alignItems: 'flex-end',
		gap: 15,
		marginTop: 34
	},
	rail: {
		borderRadius: 3,
		height: 5,
		marginTop: 18,
		overflow: 'hidden',
		width: RAIL_WIDTH
	},
	root: {
		flex: 1,
		paddingHorizontal: 20
	},
	title: {
		marginTop: 22
	}
});
