import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BodyText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { RepetitionCounter } from '@/components/RepetitionCounter/RepetitionCounter.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { IstighfarProgress } from './HizbBody.types';

/** Planned readings are controlled by their saved assignment; free reading keeps a session counter. */
export const IstighfarReading = ({ children, progress }: { children: ReactNode; progress?: IstighfarProgress }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [localCount, setLocalCount] = useState(0);
	const [localTarget, setLocalTarget] = useState(11);
	const count = progress?.count ?? localCount;
	const target = progress?.target ?? localTarget;
	const disabled = progress?.disabled ?? false;
	const setTarget = (next: number) => {
		if (progress) {
			progress.onChange({ istighfarTarget: next });
		} else {
			setLocalTarget(next);
		}
	};
	const setCount = (next: number) => {
		if (progress) {
			progress.onChange({ istighfarRepetitions: next });
		} else {
			setLocalCount(next);
		}
	};
	return (
		<View style={styles.section}>
			<BodyText>{t('hpIstighfarGuide')}</BodyText>
			<View
				style={[
					styles.highlight,
					{ backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent }
				]}
			>
				{children}
			</View>
			<CaptionText>{t('hpIstighfarTarget')}</CaptionText>
			<View style={styles.targets}>
				{[11, 33, 100].map(value => (
					<Pressable
						key={value}
						accessibilityRole='radio'
						accessibilityLabel={`${t('hpIstighfarTarget')}: ${value}`}
						accessibilityState={{ selected: target === value, disabled }}
						disabled={disabled}
						style={[
							styles.target,
							{
								backgroundColor: target === value ? theme.colors.accent : theme.colors.surface,
								opacity: disabled ? 0.6 : 1
							}
						]}
						onPress={() => setTarget(value)}
					>
						<BodyText color={target === value ? theme.colors.onAccent : theme.colors.text}>
							{String(value)}
						</BodyText>
					</Pressable>
				))}
			</View>
			<RepetitionCounter count={count} required={target} isDisabled={disabled} onChange={setCount} />
			{!progress || progress.sessionOnly ? (
				<CaptionText color={theme.colors.subtext}>{t('hpIstighfarSession')}</CaptionText>
			) : null}
		</View>
	);
};
const styles = StyleSheet.create({
	section: { gap: 12, marginBottom: 22 },
	highlight: { borderWidth: 1, borderRadius: 14, padding: 16 },
	targets: { flexDirection: 'row', gap: 8 },
	target: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }
});
