import { GroupProgressSummary } from '@/components/GroupProgressSummary/GroupProgressSummary.component';
import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { BodyStrongText, CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
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
	footerMoreCount = 0,
	isActionDisabled = false,
	isActionPrimary = true,
	kind,
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
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const hasProgress = readCount !== undefined && percent !== undefined;
	const hasFooter = Boolean(footerLabel || footerLeading || actionLabel);

	/*
	 * **Every card says what it reads, not only the hatim ones.** Q2's whole subject is one
	 * list holding both, and a tag that appears on a card only when it is unusual makes the
	 * other kind the unmarked default — which it stops being the moment somebody has one of
	 * each.
	 *
	 * **Filled, and in the one fill nothing else uses.** The design draws this chip in sand
	 * for a hatim and sage for a Cevşen group, beside exactly one other chip. Our cards stack
	 * up to three, and both of those fills are already spoken for by the chips under it: sand
	 * is "Toplanıyor" and sage is "Açık" — so a gathering hatim read as two identical sand
	 * chips, and a running Cevşen group as two identical sage ones. `neutral` is the warm
	 * grey neither of them is, and it suits a chip naming a category rather than news.
	 */
	const typeBadge = { label: kind === 'HATIM' ? t('qHatim') : t('qCevsen'), tone: 'neutral' } as const;
	const trailingBadges: { icon?: IconName; label: string; tone?: ChipTone }[] = [
		{ ...(badgeIcon ? { icon: badgeIcon } : {}), label: badgeLabel, tone: badgeTone },
		...(extraBadges ?? [])
	];

	return (
		<CardSurface onPress={onPress} style={[styles.card, style]}>
			<View style={styles.headerRow}>
				{/*
				 * **The kind's mark, beside the name** — a tesbih or an open mushaf, saying only
				 * which kind this is. The card already states its progress twice below, in the
				 * fraction and the bar or board, so a mark that filled would be a third and
				 * coarser copy. It sat inside the type chip for a moment, where a drawing on a
				 * 10pt line is a smudge with a word after it.
				 */}
				<ReadingTypeMark backgroundColor={theme.colors.card} kind={kind} size={TYPE_MARK_SIZE} />
				<View style={styles.headerCopy}>
					<TitleText>{name}</TitleText>
					{subtitle ? (
						<CaptionText color={theme.colors.subtext} style={styles.subtitle}>
							{subtitle}
						</CaptionText>
					) : null}
				</View>
				{/* `alignSelf` per chip, not `alignItems` on the stack: `Chip` pins itself to
				    flex-start so it never stretches, and that wins over the parent — which is
				    what left badges of different widths ragged instead of flush right. */}
				<View style={styles.badgeStack}>
					<Chip label={typeBadge.label} style={styles.badge} tone={typeBadge.tone} />
					{trailingBadges.map(badge => (
						<Chip
							key={badge.label}
							{...(badge.icon ? { icon: badge.icon } : {})}
							label={badge.label}
							style={styles.badge}
							tone={badge.tone ?? 'accentOutline'}
						/>
					))}
				</View>
			</View>

			{hasProgress ? <GroupProgressSummary kind={kind} percent={percent} readCount={readCount} /> : null}

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
						{footerLabel ? (
							<View style={styles.footerLabelRow}>
								<BodyStrongText numberOfLines={1} style={styles.footerLabel}>
									{footerLabel}
								</BodyStrongText>
								<SliceChip count={footerMoreCount} isCompact tone='wash' />
							</View>
						) : null}
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

/**
 * Beside a 17pt group name. Under the mark's 20pt glyph threshold on purpose — a hundred
 * beads at this size is a texture, and one ring of twelve still reads as a tesbih.
 */
const TYPE_MARK_SIZE = 24;

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
	footerLabel: {
		flexShrink: 1
	},
	footerLabelRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
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
	}
});
