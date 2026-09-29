import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Chip } from '@/components/ui/Chip/Chip.component';
import type { CachedGroupShape } from '@/lib/hooks/useCachedGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { kindLabelKey } from '@/lib/utils/groups';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

type BoneWidth = number | `${number}%`;

type Props = {
	/** What the card it was opened from already knew; a cold link knows nothing and draws a fixed plan. */
	plan: CachedGroupShape['plan'];
};

/**
 * P7 — the Hizb invite preview before it answers, in `HizbInvitePreview`'s own measures: the
 * heading, the plan (one card for a fixed plan, the three rows for a mixed one — so nothing below
 * moves when the answer lands), the 33 drawn empty, the time row and the foot's button. No status
 * line: the loaded screen has none under its button, so one here would drop the button on arrival.
 *
 * Returned as the container's children, as the screen's are.
 */
export const HizbInvitePreviewSkeleton = ({ plan }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;
	const isMixed = plan?.hizbPlan === 0;

	const cells = useMemo<CellGridItem[]>(
		() =>
			Array.from({ length: 33 }, (_, index) => ({
				backgroundColor: theme.colors.segmentTrack,
				key: index + 1,
				label: index + 1,
				labelColor: theme.colors.faintText
			})),
		[theme]
	);

	const line = (lineHeight: number, height: number, width: BoneWidth, tone: 'soft' | 'strong' = 'soft') => (
		<View style={[styles.line, { height: lineHeight }]}>
			<Bone height={height} radius={height / 2} tone={tone} width={width} />
		</View>
	);

	return (
		<>
			<View>
				{plan ? (
					<ScreenHeader
						hasBackButton
						title={plan.name}
						titleTrailing={
							<View style={styles.chips}>
								<Chip
									label={isMixed ? t('hpMixedPlan') : t('hpDays', { days: plan.hizbPlan })}
									tone='accent'
								/>
								<Chip label={t(kindLabelKey('HIZB'))} tone='neutral' />
							</View>
						}
					/>
				) : (
					<ScreenHeader hasBackButton title=' ' />
				)}
				<SkeletonPulse>
					<View style={styles.meta}>{line(17, 8, '62%')}</View>

					{isMixed ? (
						<>
							<View style={styles.eyebrow}>{line(15, 8, 150)}</View>
							<CardSurface isFlush style={styles.card}>
								{[0, 1, 2].map(index => (
									<View
										key={index}
										style={[
											styles.planRow,
											index > 0
												? { borderTopColor: divider, borderTopWidth: StyleSheet.hairlineWidth }
												: null
										]}
									>
										<Bone height={36} radius={11} width={36} />
										<View style={styles.flex}>
											{line(17, 9, 48, 'strong')}
											<View style={styles.planRowSub}>{line(17, 8, '58%')}</View>
										</View>
									</View>
								))}
							</CardSurface>
						</>
					) : (
						<CardSurface style={[styles.card, styles.planCard]}>
							<Bone height={52} radius={15} width={52} />
							<View style={styles.flex}>
								{line(17, 9, '46%', 'strong')}
								<View style={styles.planBody}>
									{line(17.25, 8, '94%')}
									{line(17.25, 8, '70%')}
								</View>
							</View>
						</CardSurface>
					)}

					<CardSurface isFlush style={styles.card}>
						<View style={styles.coverageBody}>
							<View style={styles.coverageHead}>
								<View>
									{line(26, 20, 64, 'strong')}
									<View style={styles.coverageLabel}>{line(14, 8, 110)}</View>
								</View>
								{line(17, 9, 80)}
							</View>
							<CellGrid borderWidth={1.5} columns={11} gap={4} items={cells} radius={6} />
						</View>
						<View style={[styles.timeFoot, { borderTopColor: divider }]}>
							<Bone height={15} radius={7.5} width={15} />
							<View style={styles.flex}>{line(17, 9, '52%')}</View>
							{line(17, 8, 68)}
						</View>
					</CardSurface>
				</SkeletonPulse>
			</View>

			<View style={styles.foot}>
				<SkeletonPulse>
					<Bone height={54} radius={15} width='100%' />
					<View style={styles.footNote}>{line(17, 8, 170)}</View>
				</SkeletonPulse>
			</View>
		</>
	);
};

/* `HizbInvitePreview`'s styles, measure for measure. */
const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	line: { justifyContent: 'center' },
	chips: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	meta: { marginBottom: 18 },
	card: { marginBottom: 10 },
	eyebrow: { marginBottom: 10 },
	planCard: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
	planBody: { marginTop: 2 },
	planRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
	planRowSub: { marginTop: 1 },
	coverageBody: { paddingBottom: 14, paddingHorizontal: 16, paddingTop: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	coverageLabel: { marginTop: 5 },
	timeFoot: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	foot: { marginTop: 12 },
	footNote: { alignItems: 'center', marginTop: 9 }
});
