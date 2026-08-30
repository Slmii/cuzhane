import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { CaptionText, MonoText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RoundCardProps } from './RoundCard.types';

/**
 * One finished round in the history list.
 *
 * **`memo`'d, and that is the point of it existing separately.** Rounds are append-only — a
 * daily group running a year holds 365 — so the list that renders these is windowed, and
 * windowing only pays if a row survives its parent re-rendering. Every prop here is a
 * primitive or a stable callback so the default shallow compare is enough.
 *
 * All the wording is done by the caller: this component formats nothing, which is what keeps
 * it free of the `t`/locale dependencies that would otherwise change its props each render.
 */
export const RoundCard = memo(
	({ isComplete, label, missedLabel, onPress, percent, readLabel, whenText }: RoundCardProps) => {
		const { theme } = useThemeContext();

		return (
			<CardSurface onPress={onPress} style={styles.card}>
				<View style={styles.header}>
					<View style={styles.heading}>
						<CaptionText weight='semibold'>{label}</CaptionText>
						<CaptionText color={theme.colors.subtext} style={styles.when}>
							{whenText}
						</CaptionText>
					</View>
					<Chip label={missedLabel} tone={isComplete ? 'accent' : 'missed'} />
				</View>
				<View style={styles.progress}>
					<ProgressBar
						percent={percent}
						style={styles.bar}
						// A short round fills in clay so the bar and its chip agree.
						{...(isComplete ? {} : { fillColor: theme.colors.missed })}
					/>
					<MonoText color={theme.colors.faintText}>{readLabel}</MonoText>
				</View>
			</CardSurface>
		);
	}
);

RoundCard.displayName = 'RoundCard';

const styles = StyleSheet.create({
	bar: {
		flex: 1
	},
	card: {
		gap: 10,
		padding: 14
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	heading: {
		gap: 2
	},
	progress: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	when: {
		marginTop: 1
	}
});
