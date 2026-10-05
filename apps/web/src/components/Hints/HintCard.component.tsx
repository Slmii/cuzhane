import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { Hint } from './hints';

/** Where the card's arrow sits: which edge, and how far from the card's left. */
export type HintArrow = { edge: 'top' | 'bottom'; left: number };

type HintCardProps = {
	hint: Hint;
	/** Its place in the screen's sequence; the count shows only when there is more than one. */
	position: { n: number; of: number };
	/** Null when the card cannot sit beside its target and is pinned low instead. */
	arrow: HintArrow | null;
	onNext: () => void;
};

/**
 * One hint: the card beside what it describes, joined to it by an arrow — a 14pt square turned
 * 45° with softened corners, as the design draws it. "Devam" to the next hint of the screen,
 * "Tamam" on the last; there is no other way out.
 */
export const HintCard = ({ arrow, hint, onNext, position }: HintCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isLast = position.n >= position.of;

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.card }]}>
			{arrow ? (
				<View
					style={[
						styles.arrow,
						arrow.edge === 'top' ? styles.arrowTop : styles.arrowBottom,
						{ backgroundColor: theme.colors.card, left: arrow.left }
					]}
				/>
			) : null}
			<Typography color={theme.colors.accent} style={styles.label} weight='medium'>
				{position.of > 1
					? `${t('hintLabel')} · ${t('hintStepOf', { step: position.n, total: position.of })}`
					: t('hintLabel')}
			</Typography>

			<Typography style={styles.title} variant='header3' weight='regular'>
				{t(hint.titleKey)}
			</Typography>
			<Typography color={toAlphaColor(theme.colors.text, 0.62)} style={styles.body} variant='caption'>
				{t(hint.bodyKey)}
			</Typography>

			<View style={styles.actions}>
				<AppButton
					fullWidth={false}
					onPress={onNext}
					size='sm'
					title={t(isLast ? 'hintOk' : 'hintNext')}
					variant='primary'
				/>
			</View>
		</View>
	);
};

/* The design's measures, one to one (section T). */
const styles = StyleSheet.create({
	actions: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'flex-end',
		marginTop: 14
	},
	arrow: {
		borderRadius: 3,
		height: 14,
		position: 'absolute',
		transform: [{ rotate: '45deg' }],
		width: 14
	},
	arrowBottom: {
		bottom: -6
	},
	arrowTop: {
		top: -6
	},
	body: {
		fontSize: 13,
		lineHeight: 19.5,
		marginTop: 6
	},
	card: {
		borderRadius: 18,
		elevation: 12,
		paddingBottom: 14,
		paddingHorizontal: 17,
		paddingTop: 15,
		shadowOffset: { height: 18, width: 0 },
		shadowOpacity: 0.28,
		shadowRadius: 22
	},
	label: {
		fontSize: 10,
		letterSpacing: 1.2,
		lineHeight: 14,
		marginBottom: 9,
		textTransform: 'uppercase'
	},
	title: {
		lineHeight: 23
	}
});
