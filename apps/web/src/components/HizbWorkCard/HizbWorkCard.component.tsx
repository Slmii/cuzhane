import { HIZB_RING_WIDTH, hizbCellPalette, HIZB_STATE_LABEL_KEYS } from '@/components/HizbBoard/hizbCellPalette';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Collapsible } from '@/components/ui/Collapsible/Collapsible.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, CaptionText, MonoText, TitleText } from '@/components/ui/Typography/Typography.component';
import { portion } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { HizbIndexRow } from '@/lib/utils/hizbIndex';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import type { HizbWorkCardProps } from './HizbWorkCard.types';

/** HZ2's 30px tile at the scale the board's 24 became 28 on a phone. */
const TILE_SIZE = 34;
const TILE_RADIUS = 10;
/** `Collapsible`'s own duration, so the chevron turns as the rows open. */
const CHEVRON_DURATION_MS = 240;
const CHEVRON_OPEN_DEGREES = 90;

type RowProps = {
	row: HizbIndexRow;
	onOpenPart: (partNumber: number) => void;
};

/**
 * One portion: its number in the board's own colours, where it starts and ends, and who has it
 * this round. The whole row opens the reader on it.
 */
const PortionRow = ({ onOpenPart, row }: RowProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const palette = hizbCellPalette(row, theme);
	const holder = row.isMine ? t('hizbIndexYou') : row.holderName;
	// The legend's words for read and unclaimed; "being read" for everything held and still open.
	const status = row.state === 'taken' ? t('hizbStatusReading') : t(HIZB_STATE_LABEL_KEYS[row.state]);
	const statusColor =
		row.state === 'read'
			? theme.colors.accent
			: row.state === 'pool'
			? theme.colors.sandText
			: theme.colors.faintText;
	const description = t(portion(row.number).descriptionKey);

	return (
		<Pressable
			accessibilityLabel={[`${t('portion')} ${row.number}`, description, holder, status]
				.filter(Boolean)
				.join(', ')}
			accessibilityRole='button'
			onPress={() => onOpenPart(row.number)}
			style={({ pressed }) => [
				styles.row,
				{
					borderTopColor: theme.colors.divider,
					// HZ2 washes your own rows in the faintest sage, so a work shows at a glance
					// which of its portions are yours.
					backgroundColor: row.isMine
						? toAlphaColor(theme.colors.accentSoft, 0.55)
						: theme.colors.transparent,
					opacity: pressed ? 0.7 : 1
				}
			]}
		>
			<View style={[styles.tile, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
				{row.state === 'pool' ? <Hatch radius={TILE_RADIUS} /> : null}
				<CaptionText color={palette.labelColor} weight='semibold'>
					{row.number}
				</CaptionText>
			</View>
			<View style={styles.rowCopy}>
				<BodyText>{description}</BodyText>
				<View style={styles.meta}>
					{holder ? (
						<>
							<CaptionText color={theme.colors.subtext}>{holder}</CaptionText>
							<CaptionText color={theme.colors.faintText}>·</CaptionText>
						</>
					) : null}
					<CaptionText color={statusColor} weight='semibold'>
						{status}
					</CaptionText>
				</View>
			</View>
		</Pressable>
	);
};

/**
 * A work of the Hizb on the Fihrist (HZ2): its name, the portions it spans and how many of them
 * the group has read, opening in place onto a row per portion.
 *
 * The rows stay mounted while the card is shut — `Collapsible` needs them to measure — so a
 * whole Fihrist is 33 rows however many cards are open, and opening one is a height, not a
 * mount.
 */
const HizbWorkCardComponent = ({ entry, isOpen, onOpenPart, onToggle }: HizbWorkCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const isReducedMotion = useReducedMotion();
	const { readCount, rows, work } = entry;
	const [first, last] = work.parts;
	const span = first === last ? t('hizbWorkSpanOne', { a: first }) : t('hizbWorkSpan', { a: first, b: last });
	const isComplete = rows.length > 0 && readCount === rows.length;
	const count = `${readCount}/${rows.length}`;

	// The base glyph points right; open turns it down at the rows it has revealed.
	const chevronStyle = useAnimatedStyle(() => {
		const angle = `${isOpen ? CHEVRON_OPEN_DEGREES : 0}deg`;

		return {
			transform: [{ rotate: isReducedMotion ? angle : withTiming(angle, { duration: CHEVRON_DURATION_MS }) }]
		};
	});

	return (
		<CardSurface isFlush>
			<Pressable
				accessibilityLabel={`${t(work.titleKey)}, ${span}, ${count}`}
				accessibilityRole='button'
				accessibilityState={{ expanded: isOpen }}
				onPress={() => onToggle(work.key)}
				style={({ pressed }) => [
					styles.header,
					{
						// The open card's header steps back a shade, as HZ2 draws it, so the rows under
						// it read as its contents rather than as the next card.
						backgroundColor: isOpen ? toAlphaColor(theme.colors.background, 0.6) : theme.colors.transparent,
						opacity: pressed ? 0.7 : 1
					}
				]}
			>
				<View style={styles.headerCopy}>
					<TitleText numberOfLines={1}>{t(work.titleKey)}</TitleText>
					<CaptionText color={theme.colors.faintText} style={styles.span}>
						{span}
					</CaptionText>
				</View>
				<MonoText color={isComplete ? theme.colors.accent : theme.colors.faintText}>{count}</MonoText>
				<Animated.View style={chevronStyle}>
					<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
				</Animated.View>
			</Pressable>
			<Collapsible isOpen={isOpen}>
				{/* Mounted while shut, so hidden from VoiceOver and TalkBack then too — `Collapsible`
				    only takes them out of reach of a finger. */}
				<View
					accessibilityElementsHidden={!isOpen}
					importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
				>
					{rows.map(row => (
						<PortionRow key={row.number} onOpenPart={onOpenPart} row={row} />
					))}
				</View>
			</Collapsible>
		</CardSurface>
	);
};

export const HizbWorkCard = memo(HizbWorkCardComponent);

HizbWorkCard.displayName = 'HizbWorkCard';

const styles = StyleSheet.create({
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	headerCopy: {
		flex: 1,
		minWidth: 0
	},
	meta: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		marginTop: 4
	},
	row: {
		alignItems: 'flex-start',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	rowCopy: {
		flex: 1,
		minWidth: 0
	},
	span: {
		marginTop: 2
	},
	tile: {
		alignItems: 'center',
		borderRadius: TILE_RADIUS,
		borderWidth: HIZB_RING_WIDTH,
		height: TILE_SIZE,
		justifyContent: 'center',
		overflow: 'hidden',
		width: TILE_SIZE
	}
});
