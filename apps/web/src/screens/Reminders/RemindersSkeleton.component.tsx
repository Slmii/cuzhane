import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/**
 * The Reminders screen, before its settings arrive: one card per switch, with the clock inside
 * the first of them.
 *
 * The screen title is real and sits outside this — it is a constant, not something the
 * request supplies — so only the cards are stubbed.
 */
/**
 * One per switch on the screen — six of them — and the widths stand in for hints of different
 * lengths, since identical bones read as a table rather than as sentences about to arrive.
 *
 * **Its length is the screen's section count.** It was three while the screen had six, so the
 * page grew by half again as the settings landed.
 */
const TOGGLE_HINT_WIDTHS = [186, 168, 196, 204, 174, 190] as const;

export const RemindersSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View>
			<SkeletonPulse style={styles.stack}>
				{/*
				 * **One card per switch, which is the shape the screen actually has.** Its count
				 * has been wrong twice: once when this drew a single toggle row for a screen with
				 * three sections, and again when it kept three for a screen with six. Both times
				 * the page grew as the settings landed.
				 */}
				{TOGGLE_HINT_WIDTHS.map((hintWidth, index) => (
					<CardSurface isFlush key={index}>
						<View style={styles.toggleRow}>
							<View style={styles.toggleCopy}>
								<Bone height={12} radius={5} width={132} />
								<Bone height={8} radius={4} tone='soft' width={hintWidth} />
							</View>
							<Bone height={22} radius={11} width={38} />
						</View>
						{/* The clock, in the daily reminder's section only — see `RemindersScreen`. */}
						{index === 0 ? (
							<View style={[styles.timeBlock, { borderTopColor: theme.colors.divider }]}>
								<Bone height={9} radius={4.5} tone='soft' width={64} />
								<Bone height={40} radius={12} width={148} />
								<Bone height={8} radius={4} tone='soft' width={128} />
							</View>
						) : null}
					</CardSurface>
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
