import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { TourDoneMark } from './TourDoneMark.component';
import type { TourStep } from './tourSteps';

type TourCenterCardProps = {
	step: TourStep;
	/** Başlayalım (T1) or Tamam (Z1). */
	onPrimary: () => void;
	/** "Şimdi değil" — T1 only; it asks before ending (TX). */
	onLater?: () => void;
};

/**
 * The tour's two bookends (section T), centred over Ana sayfa: T1, which says what the tour is
 * and that nothing in it is saved, and Z1, which says the samples are gone.
 *
 * **T1 is a card over the app, not a sheet any more.** The old welcome was a sheet that asked
 * whether to take the tour at all; T1 is the tour's first stop, already standing on the sample Ana
 * sayfa it is about to walk. Declining still asks first, through the same TX as "Turu geç".
 *
 * Z1 carries its part's label ("KAPANIŞ · 1/1") because it is a stop of the run like any other;
 * T1 carries none, being the start of the start.
 *
 * **Z1 ends on the mosque being drawn** (`TourDoneMark`) rather than the design's logo tile, with
 * its words centred under it: the tour's close had it before this section, and it stayed.
 */
export const TourCenterCard = ({ onLater, onPrimary, step }: TourCenterCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isClosing = step.kind === 'closing';
	const textAlign = isClosing ? 'center' : 'auto';

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.card }]}>
			{isClosing ? (
				<Typography color={theme.colors.accent} style={styles.leg} textAlign={textAlign} weight='medium'>
					{`${t('tourLegEnd')} · 1/1`}
				</Typography>
			) : null}
			{isClosing ? (
				<TourDoneMark />
			) : (
				<View style={[styles.mark, { backgroundColor: theme.colors.accent, shadowColor: theme.colors.accent }]}>
					<BrandMark
						color={theme.colors.onHeaderSurface}
						fadedColor={toAlphaColor(theme.colors.onHeaderSurface, 0.55)}
						size={30}
					/>
				</View>
			)}
			<View>
				<Typography style={styles.title} variant='header2' textAlign={textAlign}>
					{t(step.titleKey)}
				</Typography>
				<Typography
					color={toAlphaColor(theme.colors.text, 0.62)}
					style={styles.body}
					variant='caption'
					textAlign={textAlign}
				>
					{t(step.bodyKey)}
				</Typography>
			</View>
			<View style={styles.actions}>
				<AppButton
					onPress={onPrimary}
					size='lg'
					title={t(isClosing ? 'tourOk' : 'tourStart')}
					variant='primary'
				/>
				{onLater ? (
					<Pressable accessibilityRole='button' onPress={onLater} style={styles.later}>
						<Typography
							color={toAlphaColor(theme.colors.text, 0.55)}
							style={styles.laterLabel}
							textAlign='center'
							weight='semibold'
						>
							{t('tourLater')}
						</Typography>
					</Pressable>
				) : null}
			</View>
		</View>
	);
};

/* The design's measures, one to one (section T, T1 and Z1). */
const styles = StyleSheet.create({
	actions: {
		gap: 6,
		marginTop: 4
	},
	body: {
		fontSize: 13,
		lineHeight: 20,
		marginTop: 7
	},
	card: {
		borderRadius: 22,
		elevation: 12,
		gap: 14,
		paddingBottom: 16,
		paddingHorizontal: 20,
		paddingTop: 22,
		shadowOffset: { height: 18, width: 0 },
		shadowOpacity: 0.28,
		shadowRadius: 22
	},
	later: {
		padding: 12
	},
	laterLabel: {
		fontSize: 12.5,
		lineHeight: 16
	},
	leg: {
		fontSize: 10,
		letterSpacing: 1.2,
		lineHeight: 14,
		textTransform: 'uppercase'
	},
	mark: {
		alignItems: 'center',
		borderRadius: 16,
		elevation: 6,
		height: 52,
		justifyContent: 'center',
		shadowOffset: { height: 8, width: 0 },
		shadowOpacity: 0.26,
		shadowRadius: 11,
		width: 52
	},
	title: {
		lineHeight: 27.6
	}
});
