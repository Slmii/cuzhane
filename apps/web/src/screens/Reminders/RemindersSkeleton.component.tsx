import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * The Reminders screen, before its settings arrive: its sections as drawn — a heading, then one
 * card holding that section's switches — with the clock under the daily reminder.
 *
 * The screen title is real and sits outside this — it is a constant, not something the
 * request supplies — so only the sections are stubbed.
 */
/**
 * **The screen's shape, section by section: Genel, Kuran, Cevşen, Hizbü'l-Hakaik.** One width per
 * switch, standing in for hints of different lengths, since identical bones read as a table rather
 * than as sentences about to arrive. Change it with the screen, or the page jumps as settings land.
 */
const SECTIONS = [
	{ labelWidth: 52, hintWidths: [186, 168] },
	{ labelWidth: 46, hintWidths: [196, 204, 174] },
	{ labelWidth: 50, hintWidths: [190, 182, 200, 170], hasClock: true },
	{ labelWidth: 96, hintWidths: [206] }
] as const;

export const RemindersSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View>
			<SkeletonPulse style={styles.stack}>
				{SECTIONS.map((section, sectionIndex) => (
					<Fragment key={sectionIndex}>
						<View style={styles.sectionLabel}>
							<Bone height={9} radius={4.5} tone='soft' width={section.labelWidth} />
						</View>
						<CardSurface isFlush>
							{section.hintWidths.map((hintWidth, rowIndex) => (
								<Fragment key={rowIndex}>
									<View
										style={[
											styles.toggleRow,
											rowIndex > 0 && styles.stackedRow,
											{ borderTopColor: theme.colors.divider }
										]}
									>
										<View style={styles.toggleCopy}>
											<Bone height={12} radius={5} width={132} />
											<Bone height={8} radius={4} tone='soft' width={hintWidth} />
										</View>
										<Bone height={22} radius={11} width={38} />
									</View>
									{/* The clock sits under the daily reminder, the Cevşen card's first row. */}
									{'hasClock' in section && rowIndex === 0 ? (
										<View style={[styles.timeBlock, { borderTopColor: theme.colors.divider }]}>
											<Bone height={9} radius={4.5} tone='soft' width={64} />
											<Bone height={40} radius={12} width={148} />
											<Bone height={8} radius={4} tone='soft' width={128} />
										</View>
									) : null}
								</Fragment>
							))}
						</CardSurface>
					</Fragment>
				))}
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingReminders')} />
		</View>
	);
};

const styles = StyleSheet.create({
	stack: {
		gap: 12
	},
	// The screen's own section heading spacing (`RemindersScreen`'s `sectionLabel`).
	sectionLabel: {
		marginBottom: -4,
		marginTop: 6
	},
	stackedRow: {
		borderTopWidth: StyleSheet.hairlineWidth
	},
	timeBlock: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 11,
		padding: 15
	},
	// `FormToggleRow`'s own metrics, so the bones stand exactly where the switches will.
	toggleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		padding: 15
	},
	toggleCopy: {
		flex: 1,
		gap: 8,
		minWidth: 0
	}
});
