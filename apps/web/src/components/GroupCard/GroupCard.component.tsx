import { GroupProgressSummary } from '@/components/GroupProgressSummary/GroupProgressSummary.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { CaptionText, BodyStrongText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { GroupCardProps } from './GroupCard.types';

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
	name,
	onAction,
	onPress,
	percent,
	readCount,
	resetRow,
	extraBadges,
	style,
	subtitle
}: GroupCardProps) => {
	const { theme } = useThemeContext();
	const hasProgress = readCount !== undefined && percent !== undefined;
	const hasFooter = Boolean(footerLabel || footerLeading || actionLabel);

	return (
		<CardSurface onPress={onPress} style={[styles.card, style]}>
			<View style={styles.headerRow}>
				<View style={styles.headerCopy}>
					<TitleText>{name}</TitleText>
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

			{hasProgress ? <GroupProgressSummary percent={percent} readCount={readCount} /> : null}

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
					) : actionLabel ? (
						// Display-only: the whole card is already the tap target.
						<View
							style={[
								styles.staticAction,
								{
									backgroundColor: isActionPrimary ? theme.colors.primary : theme.colors.surfaceMuted,
									borderRadius: theme.radius.md
								}
							]}
						>
							<CaptionText
								color={isActionPrimary ? theme.colors.onPrimary : theme.colors.text}
								weight='semibold'
							>
								{actionLabel}
							</CaptionText>
						</View>
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
	staticAction: {
		paddingHorizontal: 15,
		paddingVertical: 9
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
	}
});
