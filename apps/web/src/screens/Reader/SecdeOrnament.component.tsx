import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { arabicReaderFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	cubicBezier,
	runOnJS,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

/** The Icon Set's "Secde süsü", reader size: 44 across, on a `-10.5 -10.5 21 21` box. */
export const SECDE_ORNAMENT_SIZE = 44;
/** The Icon Set's reader sample hangs it `top: -22px; right: 18px` off the reading block. */
export const SECDE_ORNAMENT_OVERHANG = SECDE_ORNAMENT_SIZE / 2;
const SECDE_ORNAMENT_RIGHT = 18;
/**
 * The word a printed mushaf sets beside such a verse, in place of the design's ۩ — on request,
 * since the sign alone says nothing to someone who does not already know it. Arabic on the page,
 * like the verse ornaments, not interface copy; the screen reader hears `qSecdeAyah`.
 */
const SECDE_WORD = 'سجدة';
/**
 * **Where the word sits is per platform, and read off the simulators.** A text is placed by its
 * line box, and the two platforms put Amiri's letters at different heights inside the same
 * box: the style that centres it on iOS left it about 5pt low on Android. On Android it is one
 * line exactly as tall as the mark, lifted 3pt. SVG text on an explicit baseline would be
 * exact on both — as `Ornament` sets its numeral — but Android's SVG does not shape Arabic:
 * the letters came out unjoined and left to right.
 */
const WORD_SIZE = 10;
const ANDROID_WORD_LIFT = 3;
const STAR_PATH =
	'M0-9.5L2.7-6.6 6.7-6.7 6.6-2.7 9.5 0 6.6 2.7 6.7 6.7 2.7 6.6 0 9.5-2.7 6.6-6.7 6.7-6.6 2.7-9.5 0-6.6-2.7-6.7-6.7-2.7-6.6Z';
/** A drag has to mean it before it moves the mark, so a tap stays a tap. */
const DRAG_ACTIVATE_Y = 6;
const DRAG_FAIL_X = 16;
/** Arriving it slides leftward into its corner, in from the edge; leaving, back out rightward. */
const SLIDE_OFFSET = 28;
const SLIDE_MS = 280;
const SLIDE_EASING = cubicBezier(0.2, 0.9, 0.3, 1);
const SLIDE_IN = {
	'0%': { opacity: 0, transform: [{ translateX: SLIDE_OFFSET }] },
	'100%': { opacity: 1, transform: [{ translateX: 0 }] }
};
const SLIDE_OUT = {
	'0%': { opacity: 1, transform: [{ translateX: 0 }] },
	'100%': { opacity: 0, transform: [{ translateX: SLIDE_OFFSET }] }
};

type SecdeOrnamentProps = {
	/** The page on screen if it carries a sajdah verse, `undefined` if it does not. */
	secdePage: number | undefined;
	/** The reading block's height — the paper the mark rides the right edge of. */
	blockHeight: number;
	/** Scrolls the reader to the sajdah verse's green. */
	onPress: () => void;
};

/**
 * The sajdah mark on a Hüsrev page — the Icon Set's "Secde süsü": a gilt eight-point star over a
 * rotated inner one and a ring, holding سجدة. It floats at the reading block's top-right corner
 * on any page carrying a sajdah verse, wherever on the page the verse is — tapping it scrolls there.
 *
 * **It lives beside the pages, not on one**, so it can leave: turning onto a sajdah page slides it
 * in, turning off one slides it out. A page is remounted on every turn, and a mark inside it
 * would be gone before any exit could play. Keyframes rather than `entering`/`exiting`, as the
 * cüz turn does; before its first appearance it renders nothing, so a reader opened on a page
 * without a sajdah never plays an exit.
 *
 * **It slides, up and down only, along the right edge.** Where it rests can cover the ink of the
 * page's first line, so it can be dragged out of the way — never sideways, and never past the
 * block: it stops with its foot on the paper's bottom edge. Each sajdah page starts it at the top.
 *
 * The light and dark twins are the tokens' (`mushafMark*`); unlike the page's paper it sits on
 * the reader's own ground, half over its edge, so it follows the theme.
 */
export const SecdeOrnament = ({ blockHeight, onPress, secdePage }: SecdeOrnamentProps) => {
	const isReducedMotion = useReducedMotion();
	// The last sajdah page shown — kept while the mark slides out, so it leaves where it was.
	// Adjusted during render; until there is one, there is nothing to draw.
	const [markPage, setMarkPage] = useState(secdePage);
	const isShown = secdePage !== undefined;

	if (isShown && secdePage !== markPage) {
		setMarkPage(secdePage);
	}

	if (markPage === undefined) {
		return null;
	}

	return (
		<Animated.View
			pointerEvents={isShown ? 'box-none' : 'none'}
			style={[
				styles.slot,
				{
					animationDuration: isReducedMotion ? 0 : SLIDE_MS,
					animationFillMode: 'both',
					animationName: isShown ? SLIDE_IN : SLIDE_OUT,
					animationTimingFunction: SLIDE_EASING
				}
			]}
		>
			<DraggableMark blockHeight={blockHeight} key={markPage} onPress={onPress} />
		</Animated.View>
	);
};

const DraggableMark = ({ blockHeight, onPress }: Pick<SecdeOrnamentProps, 'blockHeight' | 'onPress'>) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const offset = useSharedValue(0);
	const dragStart = useSharedValue(0);
	// From resting half over the top edge down to sitting on the bottom one, and no further.
	const travel = Math.max(0, blockHeight - SECDE_ORNAMENT_OVERHANG);
	const gilt = theme.colors.mushafMarkGilt;
	const isDark = theme.mode === 'dark';

	const pan = Gesture.Pan()
		.activeOffsetY([-DRAG_ACTIVATE_Y, DRAG_ACTIVATE_Y])
		.failOffsetX([-DRAG_FAIL_X, DRAG_FAIL_X])
		.onBegin(() => {
			dragStart.value = offset.value;
		})
		.onUpdate(event => {
			offset.value = Math.min(travel, Math.max(0, dragStart.value + event.translationY));
		});

	const tap = Gesture.Tap().onEnd((_event, isSuccessful) => {
		if (isSuccessful) {
			runOnJS(onPress)();
		}
	});

	const drag = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

	/*
	 * The design's `drop-shadow(0 6px 12px …)` (14px in dark). iOS draws a shadow from the
	 * star's own alpha when the view has no background; Android's elevation needs one, so it
	 * takes the `dropShadow` filter instead. The token carries the shadow's alpha.
	 */
	const shadowBlur = isDark ? 14 : 12;
	const shadow =
		Platform.OS === 'android'
			? {
					filter: [
						{
							dropShadow: {
								color: theme.colors.mushafMarkShadow,
								offsetX: 0,
								offsetY: 6,
								standardDeviation: shadowBlur / 2
							}
						}
					]
			  }
			: { shadowColor: theme.colors.mushafMarkShadow, shadowRadius: shadowBlur / 2 };

	return (
		<GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
			<Animated.View
				accessibilityLabel={t('qSecdeAyah')}
				accessibilityRole='button'
				accessible
				onAccessibilityTap={onPress}
				style={[styles.mark, shadow, drag]}
			>
				<Svg
					height={SECDE_ORNAMENT_SIZE}
					style={styles.star}
					viewBox='-10.5 -10.5 21 21'
					width={SECDE_ORNAMENT_SIZE}
				>
					<Path d={STAR_PATH} fill={theme.colors.mushafMarkSurface} stroke={gilt} strokeWidth={0.6} />
					<Path d={STAR_PATH} fill='none' rotation={22.5} scale={0.78} stroke={gilt} strokeWidth={0.35} />
					<Circle fill={toAlphaColor(gilt, isDark ? 0.12 : 0.1)} r={5.4} stroke={gilt} strokeWidth={0.45} />
				</Svg>
				<Typography
					color={gilt}
					style={[styles.word, { fontFamily: arabicReaderFonts.amiri }]}
					textAlign='center'
				>
					{SECDE_WORD}
				</Typography>
			</Animated.View>
		</GestureDetector>
	);
};

const styles = StyleSheet.create({
	mark: {
		alignItems: 'center',
		height: SECDE_ORNAMENT_SIZE,
		justifyContent: 'center',
		shadowOffset: { height: 6, width: 0 },
		shadowOpacity: 1,
		width: SECDE_ORNAMENT_SIZE
	},
	slot: {
		position: 'absolute',
		right: SECDE_ORNAMENT_RIGHT,
		top: -SECDE_ORNAMENT_OVERHANG,
		zIndex: 2
	},
	star: {
		position: 'absolute'
	},
	word: Platform.select({
		android: {
			fontSize: WORD_SIZE,
			height: SECDE_ORNAMENT_SIZE,
			left: 0,
			lineHeight: SECDE_ORNAMENT_SIZE,
			position: 'absolute',
			right: 0,
			textAlignVertical: 'center',
			top: -ANDROID_WORD_LIFT
		},
		default: {
			fontSize: WORD_SIZE,
			lineHeight: 16,
			paddingTop: 2
		}
	})
});
