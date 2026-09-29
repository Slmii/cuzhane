import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { EYEBROW_LINE_HEIGHT } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Lines of the passage. The last is short, the way a paragraph ends. */
const LINE_WIDTHS = ['100%', '94%', '100%', '88%', '97%', '100%', '91%', '58%'] as const;
/** `AppButton`'s icon-only disc and its `lg` height — the footer's two page buttons and the middle one. */
const DISC_SIZE = 44;
const BUTTON_HEIGHT = 54;

/**
 * The plan reader (`HizbPlanReader`) before its reading arrives: the same safe area, ground and
 * tab-bar inset, the heading — the centred place row under the bar (the section and the page, two
 * eyebrow lines between two equal side slots), the date and portion caption and the title — the
 * passage right-aligned (it is Arabic), and the footer: a hairline, then the previous-page disc,
 * the wide middle button and the next-page disc.
 *
 * No hint line over the footer: only a portion with a repetition still owed has one.
 */
export const HizbPlanReaderSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.screen, { backgroundColor: theme.colors.readerSurface, paddingBottom: tabBarOffset }]}
		>
			<SkeletonPulse style={styles.screen}>
				<View style={styles.heading}>
					<View style={styles.placeRow}>
						<View style={styles.placeSide} />
						<View style={styles.placeCenter}>
							<Bone height={7} radius={3.5} style={styles.eyebrow} tone='soft' width={132} />
							<Bone height={7} radius={3.5} style={styles.eyebrow} tone='soft' width={64} />
						</View>
						<View style={styles.placeSide} />
					</View>
					{/* The caption's 17pt line, then the title's 22. */}
					<Bone height={8} radius={4} style={styles.caption} tone='soft' width={150} />
					<Bone height={12} radius={6} style={styles.title} width='64%' />
				</View>
				<View style={styles.body}>
					<View style={styles.passage}>
						{LINE_WIDTHS.map((width, index) => (
							<Bone height={14} key={index} radius={7} width={width} />
						))}
					</View>
					<SkeletonStatusRow label={t('loadingPortion')} />
				</View>
				<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
					<View style={styles.actions}>
						<Bone height={DISC_SIZE} radius={DISC_SIZE / 2} width={DISC_SIZE} />
						<Bone height={BUTTON_HEIGHT} radius={15} style={styles.fill} />
						<Bone height={DISC_SIZE} radius={DISC_SIZE / 2} width={DISC_SIZE} />
					</View>
				</View>
			</SkeletonPulse>
		</SafeAreaView>
	);
};

/* `HizbPlanReader`'s own measures, each bone centred in the line it stands in for. */
const styles = StyleSheet.create({
	screen: { flex: 1 },
	heading: { paddingHorizontal: 20, paddingTop: 8, gap: 6, paddingBottom: 8 },
	placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 44 },
	placeSide: { flex: 1, minWidth: 96 },
	placeCenter: { alignItems: 'center', flexShrink: 1 },
	eyebrow: { marginVertical: (EYEBROW_LINE_HEIGHT - 7) / 2 },
	caption: { marginVertical: 4.5 },
	title: { marginVertical: 5 },
	// The scroll view's flex and the body's 22 of padding.
	body: { flex: 1, padding: 22 },
	passage: { alignItems: 'flex-end', gap: 15 },
	footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
	actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	fill: { flex: 1 }
});
