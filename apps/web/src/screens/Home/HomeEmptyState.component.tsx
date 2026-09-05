import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Header2, StatText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { HomeEmptyStateProps } from './HomeEmptyState.types';

/** The design's 56pt tile, and the mark that sits in it. */
const MARK_TILE = 56;
const MARK_SIZE = 28;

/**
 * **H1-E — Ana sayfa with nobody to read for yet.** The two layers stay exactly as they are;
 * only the paper sheet changes, and it holds the two ways into a group rather than a streak
 * and a list.
 *
 * **The streak card is absent here, and the copy says why**: a run of days and a week strip
 * are a record of shares taken, so with no group they would read as a zero the reader had
 * somehow already lost. The screen promises them instead.
 *
 * Joining leads, creating follows — someone arriving with nothing is far more often holding a
 * friend's code than starting a hatim of their own, and the QR they may have just scanned
 * lands on the same sheet. Keşfet sits below a rule as a third, quieter way in: it is browsing,
 * not a decision.
 *
 * The mark in the tile is the app's own (`BrandMark`), where the design draws a bare `ح`. A
 * letter set as an icon is the one thing the icon rules refuse, and the emblem says the same
 * thing in the app's hand.
 */
export const HomeEmptyState = ({ onCreate, onDiscover, onJoin }: HomeEmptyStateProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<View style={styles.container}>
			<View style={styles.markRow}>
				<View style={[styles.markTile, { backgroundColor: theme.colors.accentSoft }]}>
					<BrandMark size={MARK_SIZE} />
				</View>
			</View>

			<Header2 style={styles.title} textAlign='center'>
				{t('homeEmptyTitle')}
			</Header2>
			<Typography color={theme.colors.subtext} style={styles.body} textAlign='center' variant='caption'>
				{t('homeEmptyBody')}
			</Typography>

			<View style={styles.actions}>
				<AppButton onPress={onJoin} title={t('emptyMyJoin')} />
				<AppButton onPress={onCreate} title={t('emptyMyCreate')} variant='surface' />
			</View>

			<View style={styles.rule}>
				<Divider style={styles.ruleLine} />
				<StatText color={theme.colors.faintText}>{t('homeEmptyOr')}</StatText>
				<Divider style={styles.ruleLine} />
			</View>

			{/* The same row shape the group screen gives Havuz and Geçen tur: a tile, a name, a
			    line under it, a chevron. The compass is Keşfet's own glyph, so the row and the
			    tab it opens are recognisably the same place. */}
			<CardSurface onPress={onDiscover} style={styles.discover}>
				<View style={[styles.discoverBadge, { backgroundColor: theme.colors.sand }]}>
					<Icon color={theme.colors.sandText} name='tabDiscover' size={18} strokeWidth={1.8} />
				</View>
				<View style={styles.discoverCopy}>
					<CaptionText weight='semibold'>{t('homeEmptyDiscoverTitle')}</CaptionText>
					<CaptionText color={theme.colors.subtext} style={styles.discoverSub}>
						{t('homeEmptyDiscoverSub')}
					</CaptionText>
				</View>
				<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
			</CardSurface>
		</View>
	);
};

const styles = StyleSheet.create({
	actions: {
		gap: 8,
		marginTop: 14
	},
	body: {
		alignSelf: 'center',
		lineHeight: 20,
		marginTop: 10,
		maxWidth: 264
	},
	container: {
		paddingTop: 8
	},
	discover: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		marginTop: 10,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	discoverBadge: {
		alignItems: 'center',
		borderRadius: 11,
		height: 34,
		justifyContent: 'center',
		width: 34
	},
	discoverCopy: {
		flex: 1,
		minWidth: 0
	},
	discoverSub: {
		marginTop: 3
	},
	markRow: {
		alignItems: 'center'
	},
	markTile: {
		alignItems: 'center',
		borderRadius: 18,
		height: MARK_TILE,
		justifyContent: 'center',
		width: MARK_TILE
	},
	rule: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingBottom: 2,
		paddingTop: 20
	},
	ruleLine: {
		flex: 1
	},
	title: {
		fontSize: 21,
		lineHeight: 26,
		marginTop: 14
	}
});
