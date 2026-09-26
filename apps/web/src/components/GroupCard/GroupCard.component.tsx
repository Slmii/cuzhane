import { GroupProgressSummary } from '@/components/GroupProgressSummary/GroupProgressSummary.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { KindMark } from '@/components/ui/KindMark/KindMark.component';
import { BodyStrongText, CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { GroupCardProps } from './GroupCard.types';

/**
 * The kind mark's size before a card's name — small enough to sit on the title's line, where
 * the group screen's heading draws the same star at 44.
 */
const KIND_MARK_SIZE = 18;

/**
 * One card for both the "My groups" list and Discover. The two differ only in which
 * optional blocks they pass — progress on the former, a seat/avatar footer on the
 * latter — so the header, badge and footer layout stay in one place.
 */
export const GroupCard = ({
	actionLabel,
	badgeIcon,
	badgeLabel,
	badgeTone = 'accent',
	footerCaption,
	footerLabel,
	footerLeading,
	isActionDisabled = false,
	isActionPrimary = true,
	kind,
	name,
	onAction,
	onPress,
	progress,
	resetRow,
	extraBadges,
	style,
	subtitle
}: GroupCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const hasProgress = progress !== undefined;
	const hasFooter = Boolean(footerLabel || footerLeading || actionLabel);

	return (
		<CardSurface onPress={onPress} style={[styles.card, style]}>
			<View style={styles.headerRow}>
				<View style={styles.headerCopy}>
					{/*
					 * The Hizb's star before a Hizb group's name, so the two books tell apart down a
					 * list; a Cevşen card has none and draws as it always has. Centred on the title's
					 * first line however far the name wraps, and named, so the card is announced with
					 * its book — the card is one accessible element, and it reads its children's labels.
					 */}
					{kind === 'HIZB' ? (
						<View style={styles.titleRow}>
							<View accessibilityLabel={t('kindHizb')} accessible style={styles.titleMark}>
								<KindMark kind='HIZB' size={KIND_MARK_SIZE} />
							</View>
							<TitleText style={styles.titleText}>{name}</TitleText>
						</View>
					) : (
						<TitleText>{name}</TitleText>
					)}
					{subtitle ? (
						<CaptionText color={theme.colors.subtext} style={styles.subtitle}>
							{subtitle}
						</CaptionText>
					) : null}
				</View>
				{extraBadges?.length ? (
					// `alignSelf` per chip, not `alignItems` on the stack: `Chip` pins itself to
					// flex-start so it never stretches, and that wins over the parent — which is
					// what left badges of different widths ragged instead of flush right.
					<View style={styles.badgeStack}>
						<Chip
							{...(badgeIcon ? { icon: badgeIcon } : {})}
							label={badgeLabel}
							style={styles.badge}
							tone={badgeTone}
						/>
						{extraBadges.map(badge => (
							<Chip
								key={badge.label}
								label={badge.label}
								style={styles.badge}
								tone={badge.tone ?? 'accentOutline'}
							/>
						))}
					</View>
				) : (
					<Chip {...(badgeIcon ? { icon: badgeIcon } : {})} label={badgeLabel} tone={badgeTone} />
				)}
			</View>

			{progress ? <GroupProgressSummary {...progress} /> : null}

			{resetRow ? <View style={styles.resetRow}>{resetRow}</View> : null}

			{hasFooter ? (
				<View
					style={[
						styles.footerRow,
						hasProgress
							? { borderTopColor: theme.colors.divider, borderTopWidth: StyleSheet.hairlineWidth }
							: null,
						hasProgress ? styles.footerDivided : styles.footerPlain
					]}
				>
					{/* Discover cards put the avatar stack beside the seat count; the Groups
					    cards stack a label over a caption. */}
					<View style={[styles.footerCopy, footerLeading ? styles.footerCopyInline : null]}>
						{footerLeading}
						{footerLabel ? <BodyStrongText>{footerLabel}</BodyStrongText> : null}
						{footerCaption ? (
							<CaptionText color={theme.colors.subtext} style={styles.footerCaption}>
								{footerCaption}
							</CaptionText>
						) : null}
					</View>
					{actionLabel && onAction ? (
						<AppButton
							disabled={isActionDisabled}
							fullWidth={false}
							onPress={onAction}
							size='sm'
							title={actionLabel}
							variant={isActionPrimary ? 'primary' : 'surface'}
						/>
					) : null}
				</View>
			) : null}
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	card: {
		padding: 18
	},
	footerCaption: {
		fontSize: 11
	},
	footerCopy: {
		flex: 1,
		gap: 3
	},
	footerCopyInline: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	footerDivided: {
		paddingTop: 14
	},
	footerPlain: {
		marginTop: 15
	},
	footerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	headerCopy: {
		flex: 1,
		gap: 4
	},
	badge: {
		alignSelf: 'flex-end'
	},
	badgeStack: {
		flexShrink: 0,
		gap: 5
	},
	resetRow: {
		marginBottom: 14
	},
	headerRow: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 14
	},
	subtitle: {
		lineHeight: 17
	},
	// `TitleText`'s own line height, so the mark sits on the first line's centre.
	titleMark: {
		height: 22,
		justifyContent: 'center'
	},
	titleRow: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 7
	},
	titleText: {
		flexShrink: 1
	}
});
