import { CuzMap, CuzMapLegend } from '@/components/CuzMap/CuzMap.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CuzPickerProps } from './CuzPicker.types';

/**
 * The thirty cüz, to pick from — QC4 when creating, and the join sheet later.
 *
 * It is `CuzMap` with a header, a legend and a rule about what may be pressed. The drawing
 * is shared with the lobby, so the two cannot disagree about what a taken cüz looks like —
 * which they briefly did: this was built with free and taken inverted, hatching the ones
 * somebody held while every other board in the app hatches the ones nobody does.
 *
 * **A cap stops selection, it does not hide cells.** When the cap is reached the unselected
 * cells stop responding but stay legible — greying the other twenty-seven out would say they
 * are taken, which is a different and worse claim. Selected cells always remain pressable,
 * so the way out of a full selection is to drop one.
 */
export const CuzPicker = ({ maxSelectable, onToggle, selectedNumbers, style, takenNumbers }: CuzPickerProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const taken = useMemo(() => new Set(takenNumbers), [takenNumbers]);
	const selected = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
	const isAtCap = maxSelectable !== null && selected.size >= maxSelectable;

	return (
		<View style={style}>
			<View style={styles.header}>
				<CaptionText weight='semibold'>{t('qPickYours')}</CaptionText>
				<CaptionText color={theme.colors.faintText}>
					{maxSelectable === null ? `${selected.size}` : `${selected.size} / ${maxSelectable}`}
				</CaptionText>
			</View>
			<CuzMap
				// Taken is somebody else's; at the cap only what is already chosen still moves.
				isPressable={number => !taken.has(number) && (!isAtCap || selected.has(number))}
				onPress={onToggle}
				stateOf={number => (selected.has(number) ? 'mine' : taken.has(number) ? 'taken' : 'free')}
			/>
			<CuzMapLegend mineLabel={t('qSelected')} />
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	}
});
