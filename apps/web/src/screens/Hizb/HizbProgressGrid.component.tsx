import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { HIZB_SECTIONS } from '@/lib/content/hizbulhakaik';
import { hizbProgress } from '@/lib/content/hizbProgress';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { HizbProgressGridProps } from './HizbProgressGrid.types';

export const HizbProgressGrid = ({ numberOfParts, assignments, onPressPart }: HizbProgressGridProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const parts = useMemo(() => hizbProgress(numberOfParts, assignments), [numberOfParts, assignments]);
	const tones = useMemo(
		() => ({
			completed: {
				backgroundColor: theme.colors.babReadByMe,
				borderColor: theme.colors.babReadByMe,
				labelColor: theme.colors.onAccent,
				label: t('hrReadStatus')
			},
			pending: {
				backgroundColor: theme.colors.surface,
				borderColor: theme.colors.accent,
				labelColor: theme.colors.accent,
				label: t('hrUnreadStatus')
			},
			upcoming: {
				backgroundColor: theme.colors.babOpen,
				borderColor: theme.colors.babOpen,
				labelColor: theme.colors.babOpenText,
				label: t('hrUpcomingStatus')
			}
		}),
		[theme, t]
	);
	const items = useMemo(
		() =>
			parts.map(part => ({
				...tones[part.status],
				key: part.partIndex,
				label: part.partIndex + 1,
				accessibilityLabel: `${t('hrPart', { part: part.partIndex + 1 })} · ${
					HIZB_SECTIONS[part.partIndex]?.title ?? ''
				} · ${tones[part.status].label}`
			})),
		[parts, tones, t]
	);
	const handlePress = useCallback(
		(key: string | number) => {
			const part = parts[Number(key)];
			if (part) {
				onPressPart?.(part.partIndex, part.assignment);
			}
		},
		[parts, onPressPart]
	);

	return (
		<View style={styles.container}>
			<CellGrid
				items={items}
				columns={6}
				gap={4}
				radius={6}
				borderWidth={1.5}
				onPressCell={onPressPart ? handlePress : undefined}
			/>
			<View style={styles.legend}>
				{Object.entries(tones).map(([status, tone]) => (
					<View key={status} style={styles.entry}>
						<View
							style={[
								styles.swatch,
								{ backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }
							]}
						/>
						<CaptionText>{tone.label}</CaptionText>
					</View>
				))}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: { gap: 12 },
	legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
	entry: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	swatch: { width: 11, height: 11, borderRadius: 3, borderWidth: 1.5 }
});
