import { HatimBook } from '@/components/HatimBook/HatimBook.component';
import { HatimBurst, HatimTwinkles } from '@/components/HatimCelebration/HatimCelebration.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import {
	BodyText,
	EyebrowText,
	Header1,
	NumericText,
	StatText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetRoundDetail } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { hatimCompletePalette as palette, toAlphaColor } from '@/lib/theme/tokens';
import { isRepeatingCycle } from '@/lib/types/domain';
import { CUZ_COUNT } from '@/lib/utils/units';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

type Props = NativeStackScreenProps<TabStackParamList, 'HatimComplete'>;

const DAY_MS = 86_400_000;
const RING_SIZE = 176;
/** The longest a push takes to land; past this the celebration starts regardless. */
const START_FALLBACK_MS = 700;

/*
 * The frame's `om-pop` on the ring: a CSS animation rather than an `entering` one, so it runs
 * from the first frame the view exists and its opening frame is also its resting style.
 */
const RING_POP = {
	'0%': { opacity: 0, transform: [{ scale: 0.55 }] },
	'62%': { opacity: 1, transform: [{ scale: 1.14 }] },
	'100%': { opacity: 1, transform: [{ scale: 1 }] }
};

/**
 * Q7 — the hatim of one round is complete: all thirty cüz read. "Hatim Tamamlandi.dc.html".
 *
 * A deep green page, lit from the top; a full ring with **a mushaf inside it** that opens, turns
 * its pages and closes (`HatimBook`), a burst of gilt as it closes (`HatimBurst`) and a few stars
 * twinkling over the page (`HatimTwinkles`). On request, the design's falling confetti was
 * removed and its replay button became a close. Under the ring, the
 * group and round, "Hatim tamamlandı", three numbers — the thirty, how many members read, how
 * many days it took — and a line at the foot saying when the next round begins.
 *
 * **Always the green page, light mode or dark**, as the design draws it — so its colours are the
 * fixed `hatimCompletePalette`, not the theme's `headerSurface`, which darkens in dark mode.
 *
 * **"Hatim duası"** opens `HatimDuaScreen` — the edition's own pages of the du'a, never typeset here.
 *
 * The foot line is the way on: "Yeni tur N gün sonra başlar" back to the group, "Devam" when a
 * completed round is only being seen after its boundary (QR1 comes next), and "Gruba dön" for a
 * one-off, which has no next round to announce. The counts come from the round's own record,
 * so a round that has since closed is counted as truly as the one in progress.
 */
export const HatimCompleteScreen = ({ navigation, route }: Props) => {
	const { groupId, roundIndex, then } = route.params;
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const insets = useSafeAreaInsets();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const isReducedMotion = useReducedMotion();
	// Read once, as the screen opens — the countdown is a day count, and a render is no clock.
	const [openedAt] = useState(() => Date.now());
	/*
	 * **The celebration waits for the screen to arrive.** It is timed from its first frame, and
	 * mounted during the push it played its opening — the ring's pop, the book opening — while the
	 * page was still sliding in. So it starts on the navigator's `transitionEnd`; until then the
	 * page shows what the design's first frame does, the inner disc and the words. A push that
	 * never animates (a `replace` with no transition) still starts, after `START_FALLBACK_MS`.
	 */
	const [hasArrived, setHasArrived] = useState(false);

	useEffect(() => {
		const unsubscribe = navigation.addListener('transitionEnd', event => {
			if (!event.data.closing) {
				setHasArrived(true);
			}
		});
		const fallback = setTimeout(() => setHasArrived(true), START_FALLBACK_MS);

		return () => {
			unsubscribe();
			clearTimeout(fallback);
		};
	}, [navigation]);

	// Reduce Motion has nothing to wait for: the still picture is drawn at once.
	const isShown = hasArrived || isReducedMotion;

	const group = useGetGroupById(groupId).data;
	const round = useGetRoundDetail(groupId, roundIndex).data;

	const ink = palette.white;
	const reads = round?.babs.filter(bab => bab.readByUserId !== null && bab.readAt !== null) ?? [];
	const readers = new Set(reads.map(bab => bab.readByUserId)).size;
	const lastReadAt = Math.max(0, ...reads.map(bab => new Date(bab.readAt as string).getTime()));
	const days = round ? Math.max(1, Math.ceil((lastReadAt - new Date(round.startedAt).getTime()) / DAY_MS)) : null;

	const daysToNextRound =
		group?.roundEndsAt !== null && group?.roundEndsAt !== undefined
			? Math.max(1, Math.ceil((new Date(group.roundEndsAt).getTime() - openedAt) / DAY_MS))
			: null;
	const footLabel = then
		? t('next')
		: group && isRepeatingCycle(group.cycle) && daysToNextRound !== null
		? t('qNextRoundIn', { n: daysToNextRound })
		: t('qBackToGroup');

	const handleContinue = () => {
		if (then) {
			navigation.replace('RoundStart', { groupId, reason: then });
		} else {
			navigation.goBack();
		}
	};

	/*
	 * **The du'a's back always lands on the group**, not here. Q7 is a once-a-round moment, and
	 * coming back to it replays nothing — so the stack is rebuilt as "…, the group, Hatim duası":
	 * Q7 comes off, and the group screen is put back under the du'a when it is not there already
	 * (when a pick follows, Q7 replaced it). A reset rather than a back handler, so the swipe and
	 * the chevron agree. The group screen then runs its own gate, which leads on to a pick still
	 * owed; the carried note that would have followed Q7 is not shown again.
	 */
	const handleOpenDua = () => {
		navigation.dispatch(state => {
			let groupIndex = -1;

			state.routes.forEach((route, index) => {
				const params = route.params as { groupId?: string } | undefined;

				if (route.name === 'GroupDetail' && params?.groupId === groupId) {
					groupIndex = index;
				}
			});

			const base =
				groupIndex >= 0
					? state.routes.slice(0, groupIndex + 1)
					: [...state.routes.slice(0, -1), { name: 'GroupDetail' as const, params: { groupId } }];

			return CommonActions.reset({ ...state, index: base.length, routes: [...base, { name: 'HatimDua' }] });
		});
	};

	const stats = [
		{ label: t('cuz'), value: CUZ_COUNT },
		{ label: t('qReaders'), value: round ? readers : '–' },
		{ label: t(pluralKey(language, days ?? 0, 'qDaysOne', 'qDays')), value: days ?? '–' }
	];

	return (
		<View style={[styles.page, { backgroundColor: palette.pageMiddle }]}>
			{/* `radial-gradient(120% 70% at 50% 22%, #4F8472, #3E6B5C 55%, #30574A)`. */}
			<Svg height='100%' style={StyleSheet.absoluteFill} width='100%'>
				<Defs>
					<RadialGradient cx='50%' cy='22%' id='page' rx='120%' ry='70%'>
						<Stop offset='0' stopColor={palette.pageLight} />
						<Stop offset='0.55' stopColor={palette.pageMiddle} />
						<Stop offset='1' stopColor={palette.pageDeep} />
					</RadialGradient>
				</Defs>
				<Rect fill='url(#page)' height='100%' width='100%' />
			</Svg>
			{isShown ? <HatimTwinkles isReducedMotion={isReducedMotion} /> : null}

			{/*
			 * The corner's close, in place of the design's replay, on request — the app's icon-only
			 * disc. It leaves the way the foot line does: back to the group, or on to QR1 when this
			 * round still has to be picked.
			 */}
			<View style={[styles.close, { top: insets.top + 10 }]}>
				<AppButton
					accessibilityLabel={t('close')}
					fullWidth={false}
					icon='close'
					onPress={handleContinue}
					variant='surface'
				/>
			</View>

			<View
				style={[
					styles.content,
					{
						// The bar steps aside for this screen (`TAB_BAR_HIDDEN_ROUTES`), which zeroes its
						// offset — so the home indicator is this screen's own to clear.
						paddingBottom: 26 + (tabBarOffset || insets.bottom),
						paddingTop: insets.top
					}
				]}
			>
				<View style={styles.hero}>
					<View style={styles.ring}>
						{isShown ? <HatimBurst isReducedMotion={isReducedMotion} /> : null}
						{isShown ? (
							<Animated.View
								style={[
									styles.ringDisc,
									{ backgroundColor: theme.colors.onHeaderSurfaceRing },
									isReducedMotion
										? null
										: {
												...RING_POP['0%'],
												animationDuration: 800,
												animationFillMode: 'both' as const,
												animationName: RING_POP,
												animationTimingFunction: cubicBezier(0.2, 1.3, 0.4, 1)
										  }
								]}
							/>
						) : null}
						<View style={[styles.ringHole, { backgroundColor: palette.pageMiddle }]} />
						{isShown ? <HatimBook isReducedMotion={isReducedMotion} /> : null}
					</View>

					<EyebrowText color={toAlphaColor(ink, 0.62)} numberOfLines={1} style={styles.eyebrow}>
						{group ? `${group.name} · ${t('qRoundN', { n: roundIndex + 1 })}` : ' '}
					</EyebrowText>
					<Header1 color={ink} style={styles.title}>
						{t('qHatimDone')}
					</Header1>
					<BodyText color={toAlphaColor(ink, 0.72)} style={styles.sub}>
						{t('qHatimDoneSub')}
					</BodyText>

					<View style={styles.stats}>
						{stats.map((stat, index) => (
							<View key={stat.label} style={styles.statRow}>
								{index > 0 ? (
									<View style={[styles.statRule, { backgroundColor: toAlphaColor(ink, 0.18) }]} />
								) : null}
								<View style={styles.stat}>
									<NumericText color={ink} style={styles.statValue}>
										{stat.value}
									</NumericText>
									<StatText color={toAlphaColor(ink, 0.55)} style={styles.statLabel}>
										{stat.label}
									</StatText>
								</View>
							</View>
						))}
					</View>
				</View>

				<View style={styles.actions}>
					{/*
					 * The design's "Hatim duası": a white button in the page's own green,
					 * `padding: 17px; border-radius: 16px; font: 600 14px`. It opens the edition's pages of
					 * the du'a in Hüsrev hattı — the one sourced text of it the app carries.
					 */}
					<Pressable
						accessibilityRole='button'
						onPress={handleOpenDua}
						style={({ pressed }) => [styles.dua, { backgroundColor: ink, opacity: pressed ? 0.85 : 1 }]}
					>
						<Typography
							color={palette.pageMiddle}
							style={styles.duaText}
							textAlign='center'
							weight='semibold'
						>
							{t('qHatimDua')}
						</Typography>
					</Pressable>
					<Pressable
						accessibilityRole='button'
						onPress={handleContinue}
						style={({ pressed }) => [styles.foot, { opacity: pressed ? 0.6 : 1 }]}
					>
						<Typography
							color={toAlphaColor(ink, 0.72)}
							style={styles.footText}
							textAlign='center'
							weight='semibold'
						>
							{footLabel}
						</Typography>
					</Pressable>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	content: {
		flex: 1,
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		zIndex: 1
	},
	// The design's 10.5px at 0.2em.
	eyebrow: {
		fontSize: 10.5,
		letterSpacing: 2.1,
		marginBottom: 12
	},
	// The design's closing column: the du'a button over the foot line, 8 apart.
	actions: {
		gap: 8
	},
	dua: {
		borderRadius: 16,
		padding: 17
	},
	duaText: {
		fontSize: 14
	},
	foot: {
		padding: 10
	},
	footText: {
		fontSize: 12.5
	},
	/*
	 * Centred both ways in the room above the foot line, on request — the design sets the ring
	 * 44pt under the status bar with the gap below it; here only the foot line stays at the bottom.
	 */
	hero: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	page: {
		flex: 1,
		overflow: 'hidden'
	},
	close: {
		position: 'absolute',
		right: 16,
		zIndex: 2
	},
	ring: {
		alignItems: 'center',
		height: RING_SIZE,
		justifyContent: 'center',
		marginBottom: 28,
		width: RING_SIZE
	},
	ringDisc: {
		borderRadius: RING_SIZE / 2,
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	ringHole: {
		borderRadius: RING_SIZE / 2 - 9,
		bottom: 9,
		left: 9,
		position: 'absolute',
		right: 9,
		top: 9
	},
	stat: {
		alignItems: 'center'
	},
	statLabel: {
		marginTop: 3
	},
	statRow: {
		flexDirection: 'row',
		gap: 18
	},
	statRule: {
		width: 1
	},
	statValue: {
		fontSize: 24,
		lineHeight: 28
	},
	stats: {
		flexDirection: 'row',
		gap: 18,
		marginTop: 26
	},
	// The design's 13.5 at 1.65.
	sub: {
		fontSize: 13.5,
		lineHeight: 22,
		marginTop: 12,
		maxWidth: 280,
		textAlign: 'center'
	},
	// Newsreader 400, 32 at 1.15.
	title: {
		fontSize: 32,
		lineHeight: 37,
		textAlign: 'center'
	}
});
