import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

type BoneWidth = number | `${number}%`;

/**
 * O1–O5 before the group answers, in `GroupHowItWorksScreen`'s measures: the pill,
 * the real title with the kind's sentence when the group is already known (one blank line when it
 * isn't), the share card, the info card with its two usual rows, and the foot's two buttons.
 * The scrolling part only; the pinned foot is `GroupHowItWorksSkeletonFoot`, both in `HowItWorksFrame`.
 */
export const GroupHowItWorksSkeleton = ({ intro }: { intro: string | null }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const line = (lineHeight: number, height: number, width: BoneWidth, tone: 'soft' | 'strong' = 'soft') => (
		<View style={[styles.line, { height: lineHeight }]}>
			<Bone height={height} radius={height / 2} tone={tone} width={width} />
		</View>
	);

	return (
		<View>
			<SkeletonPulse>
				<View style={styles.topRow}>
					<Bone height={29} radius={15} tone='soft' width={170} />
				</View>
			</SkeletonPulse>
			<ScreenTitle
				description={intro ?? ' '}
				hasReservedSecondaryLabel={false}
				label={t('hoTitle')}
				labelLines={2}
			/>
			<SkeletonPulse>
				<CardSurface style={[styles.card, styles.shareCard]}>
					{line(14, 8, 110)}
					<View style={styles.shareHead}>
						{line(26, 20, '46%', 'strong')}
						{line(17, 9, 88)}
					</View>
					<Bone height={10} radius={2} tone='soft' width='100%' />
					<View>
						{line(18.6, 9, '94%')}
						{line(18.6, 9, '62%')}
					</View>
				</CardSurface>
				<CardSurface isFlush style={styles.card}>
					{[0, 1].map(index => (
						<View
							key={index}
							style={[
								styles.row,
								index > 0
									? {
											borderTopColor: theme.colors.divider,
											borderTopWidth: StyleSheet.hairlineWidth
									  }
									: null
							]}
						>
							<Bone height={30} radius={9} width={30} />
							<View style={styles.flex}>
								{line(17, 9, '64%', 'strong')}
								<View style={styles.rowBody}>{line(16.5, 8, '86%')}</View>
							</View>
						</View>
					))}
				</CardSurface>
			</SkeletonPulse>
		</View>
	);
};

/** The pinned foot's bones, for `HowItWorksFrame`: the two buttons and the "don't show again" line. */
export const GroupHowItWorksSkeletonFoot = () => (
	<SkeletonPulse style={styles.foot}>
		<Bone height={54} radius={15} width='100%' />
		<Bone height={54} radius={15} tone='soft' width='100%' />
		<View style={styles.dontShow}>
			<Bone height={8} radius={4} tone='soft' width={200} />
		</View>
	</SkeletonPulse>
);

const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	line: { justifyContent: 'center' },
	topRow: { alignItems: 'center', flexDirection: 'row' },
	card: { marginBottom: 12 },
	shareCard: { gap: 12, padding: 16 },
	shareHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	row: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
	rowBody: { marginTop: 2 },
	foot: { gap: 4 },
	// The checkbox row's 17pt caption line, centred.
	dontShow: { alignItems: 'center', height: 19, justifyContent: 'center', paddingTop: 2 }
});
