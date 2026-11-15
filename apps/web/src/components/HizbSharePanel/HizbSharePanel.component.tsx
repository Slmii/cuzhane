import { BabRow } from '@/components/BabRow/BabRow.component';
import { HintTarget } from '@/components/Hints/HintTarget.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { portion, workOf, worksForParts } from '@/lib/content/hizbPortions';
import { useGetRepetitions } from '@/lib/hooks/useRepetitions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { requiredRepetitions } from '@/lib/utils/groupKinds';
import { hizbShareLabel } from '@/lib/utils/groups';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import type { HizbSharePanelProps } from './HizbSharePanel.types';

/*
 * The disclosure's numbers are the Cevşen panel's on the group screen, so the two kinds open
 * and close alike: the same rotation, the same duration, the same cap.
 */
const CHEVRON_DOWN_DEGREES = 90;
const CHEVRON_UP_DEGREES = -90;
const PANEL_DURATION_MS = 260;
const MAX_BODY_HEIGHT = 310;
/**
 * What a row is taken to measure before it has been — a title and a two-line description in
 * `BabRow`'s padding. Only a reservation: the measured height replaces it the frame it lands.
 */
const ESTIMATED_ROW_HEIGHT = 72;
/** `noAssigned`'s line in its padding. */
const ESTIMATED_EMPTY_HEIGHT = 61;

/**
 * HZ1's "Bu tur bölümün": the Hizb's version of the group screen's assigned panel — a sage
 * header with the share in an accent tile and the works it falls in, over a row per portion.
 *
 * **Open by default, unlike the Cevşen's.** A Hizb share is a portion or two, each with a line
 * saying where in the book it starts and ends, and that is the thing a reader opens the group
 * for; the Cevşen's closes because its share is a run of numbers the tile already states.
 *
 * Which is also why its height is reserved rather than grown into. The Cevşen panel opens from
 * nothing, so it can measure its rows while they are hidden; this one is on screen from the
 * first frame, and opening from zero once the rows reported in would push everything under it
 * down a moment after the page appeared. So it starts at an estimate, snaps to the measurement,
 * and animates only once the reader has used the chevron.
 *
 * The rows are drawn from the share, not from the board — the titles and descriptions are the
 * book's — so the panel keeps its height while the board is still loading.
 */
export const HizbSharePanel = ({
	babs,
	groupId,
	onOpenPart,
	onToggleRead,
	partNumbers,
	roundIndex,
	viewerUserId
}: HizbSharePanelProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const isReducedMotion = useReducedMotion();
	const [isOpen, setIsOpen] = useState(true);
	const [hasToggled, setHasToggled] = useState(false);
	const [rowsHeight, setRowsHeight] = useState<number | null>(null);

	const estimatedHeight =
		partNumbers.length === 0 ? ESTIMATED_EMPTY_HEIGHT : partNumbers.length * ESTIMATED_ROW_HEIGHT;
	const openHeight = Math.min(rowsHeight ?? estimatedHeight, MAX_BODY_HEIGHT);

	const chevronStyle = useAnimatedStyle(() => {
		const angle = `${isOpen ? CHEVRON_UP_DEGREES : CHEVRON_DOWN_DEGREES}deg`;

		return {
			transform: [{ rotate: isReducedMotion ? angle : withTiming(angle, { duration: PANEL_DURATION_MS }) }]
		};
	});
	const bodyStyle = useAnimatedStyle(() => {
		const height = isOpen ? openHeight : 0;
		const opacity = isOpen ? 1 : 0;

		// Snapped until the reader first toggles: the estimate's correction is not a movement.
		return isReducedMotion || !hasToggled
			? { height, opacity }
			: {
					height: withTiming(height, { duration: PANEL_DURATION_MS }),
					opacity: withTiming(opacity, { duration: PANEL_DURATION_MS })
			  };
	});

	const toggle = () => {
		setHasToggled(true);
		setIsOpen(current => !current);
	};

	/*
	 * The one portion read more than once (Sekine, 19 times). Only one call, and only asked for
	 * when it is in the share: anything else answers 400, and the table holds a single entry.
	 */
	const repeatedPart = partNumbers.find(number => requiredRepetitions('HIZB', number) > 1) ?? null;
	const repetitions = useGetRepetitions(groupId, repeatedPart ?? 0, roundIndex, repeatedPart !== null);

	const babByNumber = useMemo(() => new Map((babs ?? []).map(bab => [bab.number, bab])), [babs]);
	const readCount = partNumbers.filter(number => babByNumber.get(number)?.readAt != null).length;
	const shareLabel = hizbShareLabel(partNumbers, t('portions'));
	const worksLine = worksForParts(partNumbers)
		.map(work => t(work.titleKey))
		.join(' · ');

	return (
		// No glass while closed, as the Cevşen panel: the sage fill *is* the panel then.
		<CardSurface
			hasGlassSurface={isOpen}
			isFlush
			style={[
				// Ringed in the accent, as the Cevşen's and Kur'an's share panel.
				{ borderColor: theme.colors.accent, borderWidth: 2 },
				isOpen ? null : { backgroundColor: theme.colors.accentSoft }
			]}
		>
			{/* The group's share hint frames this row, as it frames the Cevşen's. */}
			<HintTarget id='assigned'>
				<Pressable
					accessibilityLabel={`${t('thisRoundPortions')} ${shareLabel}`}
					accessibilityRole='button'
					accessibilityState={{ expanded: isOpen }}
					onPress={toggle}
					style={[
						styles.header,
						{ backgroundColor: theme.colors.accentSoft },
						isOpen
							? { borderBottomColor: theme.colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }
							: null
					]}
				>
					<View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
						<Typography color={theme.colors.onAccent} style={styles.badgeLabel} variant='title'>
							{shareLabel}
						</Typography>
					</View>
					<View style={styles.copy}>
						<Typography color={theme.colors.accent} style={styles.eyebrow} variant='stat' weight='medium'>
							{t('thisRoundPortions')}
						</Typography>
						{worksLine ? (
							<CaptionText color={theme.colors.subtext} numberOfLines={2}>
								{worksLine}
							</CaptionText>
						) : null}
					</View>
					<View style={styles.meta}>
						<CaptionText color={theme.colors.accent} weight='semibold'>
							{`${readCount}/${partNumbers.length}`}
						</CaptionText>
						<Animated.View style={chevronStyle}>
							<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
						</Animated.View>
					</View>
				</Pressable>
			</HintTarget>
			{/* Clipped and inert while closed, for the reasons the Cevşen panel gives. */}
			<Animated.View
				accessibilityElementsHidden={!isOpen}
				importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
				pointerEvents={isOpen ? 'auto' : 'none'}
				style={[styles.body, bodyStyle]}
			>
				{/* Absolutely filling the clip, so the rows keep a height of their own to measure. */}
				<ScrollView
					nestedScrollEnabled
					scrollEnabled={isOpen && (rowsHeight ?? 0) > MAX_BODY_HEIGHT}
					style={styles.scroll}
				>
					<View onLayout={event => setRowsHeight(event.nativeEvent.layout.height)}>
						{partNumbers.length === 0 ? (
							<BodyText color={theme.colors.faintText} style={styles.noAssigned}>
								{t('noAssignedPortions')}
							</BodyText>
						) : (
							partNumbers.map(number => {
								const bab = babByNumber.get(number);
								const isRead = bab?.readAt != null;
								// Read by somebody else before it was yours — shown, not offered, as on
								// the Cevşen's rows: only the reader may take a read back.
								const isReadByOthers = isRead && bab?.readByUserId !== viewerUserId;
								const required = requiredRepetitions('HIZB', number);
								const count = required > 1 ? repetitions.data?.count : undefined;
								/*
								 * **A repeated portion is marked by its count, not by the box.** The
								 * server refuses the read (409) until all nineteen are in, so until then
								 * the box opens the reader — where they are counted — rather than
								 * offering a tick that could only fail.
								 */
								const isCountOutstanding = required > 1 && !isRead && (count ?? 0) < required;

								return (
									<BabRow
										accessibilityHint={
											isCountOutstanding ? t('hizbRepetitionsHint', { required }) : undefined
										}
										isRead={isRead}
										isReadByOthers={isReadByOthers}
										key={number}
										onOpen={() => onOpenPart(number)}
										onToggle={() => {
											// Nothing to toggle until the board says what the box is.
											if (!babs) {
												return;
											}

											if (isCountOutstanding) {
												onOpenPart(number);

												return;
											}

											onToggleRead(number, !isRead);
										}}
										openLabel={t('read')}
										subtitle={
											isReadByOthers
												? bab?.readByDisplayName
													? t('readBeforeYoursBy', { name: bab.readByDisplayName })
													: t('readBeforeYours')
												: // The count's line from the first frame, a dash until it lands:
												// swapping in from the two-line description jumped the row.
												required > 1
												? t('hizbRepetitions', { count: count ?? '—', required })
												: t(portion(number).descriptionKey)
										}
										title={t('hizbPartRowTitle', { n: number, work: t(workOf(number).titleKey) })}
									/>
								);
							})
						)}
					</View>
				</ScrollView>
			</Animated.View>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	badge: {
		alignItems: 'center',
		borderRadius: 12,
		height: 38,
		justifyContent: 'center',
		// `minWidth`, not a width: "15 · 16" and "3 bölüm" are wider than the square "7" fits in.
		minWidth: 38,
		paddingHorizontal: 8
	},
	badgeLabel: {
		fontSize: 15,
		lineHeight: 19
	},
	body: {
		overflow: 'hidden'
	},
	copy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	eyebrow: {
		letterSpacing: 0.8
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	meta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9
	},
	noAssigned: {
		paddingHorizontal: 16,
		paddingVertical: 20
	},
	scroll: {
		...StyleSheet.absoluteFill
	}
});
