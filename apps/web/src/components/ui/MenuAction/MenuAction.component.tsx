import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useRegisterOpenOverlay } from '@/lib/utils/openOverlays';
import { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import type { MenuActionItem, MenuActionProps, MenuActionSubmenu } from './MenuAction.types';

/**
 * One toolbar glyph that opens a **dropdown anchored to itself**, for a screen whose bar carries
 * several actions of the same kind. Gruplarım's key and + were two controls asking the same
 * question — how do I get into a group — so they are one + with the two answers under it.
 *
 * **iOS gets SwiftUI's `Menu`, on every version.** The fork here is by platform, not by Liquid
 * Glass support: `Menu` has existed since iOS 14 and renders the system's own popover, which
 * means correct anchoring, dismissal, haptics and Dynamic Type for free — and picks up Liquid
 * Glass on 26 without being asked. Gating it on `isLiquidGlassSupported` would have thrown all
 * of that away on iOS 18 to no purpose.
 *
 * **Android gets the drawn path below**, which is the only reason it exists. It is a hand-built
 * popover and deliberately not `ui/BottomSheet`: a sheet is a surface you commit to, animating
 * up from the far edge of the screen, and this is a two-item choice hanging off the control that
 * was tapped. `AppBottomSheet` stays the answer for everything the app calls a modal — this is
 * a menu, which the app had no primitive for.
 *
 * Required in a `try` like every other `@expo/ui` surface: the package resolves native views as
 * it loads, so a client built before it was added would throw as this module is evaluated.
 */
type SwiftUi = typeof import('@expo/ui/swift-ui');
type SwiftUiModifiers = typeof import('@expo/ui/swift-ui/modifiers');

let swiftUi: SwiftUi | null = null;
let swiftUiModifiers: SwiftUiModifiers | null = null;

try {
	swiftUi = require('@expo/ui/swift-ui') as SwiftUi;
	swiftUiModifiers = require('@expo/ui/swift-ui/modifiers') as SwiftUiModifiers;
} catch {
	swiftUi = null;
	swiftUiModifiers = null;
}

/** The trigger's glyph, and the touch target around it — `ui/CornerAction`'s toolbar metrics. */
const GLYPH_SIZE = 26;
const TARGET_SIZE = 44;

/**
 * The drawn menu's own metrics, read off D4. The panel is a fixed 236 rather than sized to its
 * widest row, so the two levels are the same width and swapping between them moves nothing but
 * the rows.
 */
const ANCHOR_GAP = 6;
const MENU_WIDTH = 236;
const SCREEN_EDGE_INSET = 12;
const PANEL_PADDING = 6;
const PANEL_RADIUS = 16;
const ROW_RADIUS = 10;
const ROW_MIN_HEIGHT = 44;
/** A row's tick, its back chevron and a command's leading glyph. */
const ROW_GLYPH_SIZE = 15;
/** The submenu chevron is a size smaller — it points, where the others mark. */
const CHEVRON_SIZE = 14;
const TOGGLE_BOX_SIZE = 19;
const TOGGLE_BOX_RADIUS = 6;
const TOGGLE_CHECK_SIZE = 11;

/**
 * D4's motion. The panel **grows from its anchor corner** (`om-menu`) rather than fading in
 * place, so it reads as coming out of the glyph that was tapped; a level then **slides in from
 * the side it came from** (`om-lvl-in` / `om-lvl-back`), which is what makes the two levels
 * feel like one panel turning a page rather than two menus taking turns.
 *
 * CSS animations, not `entering`, for the reason `CellGrid` records: a layout animation is
 * registered after its view mounts and hides the view until it takes over, which on Android
 * showed the panel for a frame and then played it in.
 */
const MENU_EASING = cubicBezier(0.2, 0.9, 0.3, 1);

const PANEL_KEYFRAMES = {
	'0%': { opacity: 0, transform: [{ scale: 0.94 }, { translateY: -6 }] },
	'100%': { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] }
};

const LEVEL_IN_KEYFRAMES = {
	'0%': { opacity: 0, transform: [{ translateX: 9 }] },
	'100%': { opacity: 1, transform: [{ translateX: 0 }] }
};

const LEVEL_BACK_KEYFRAMES = {
	'0%': { opacity: 0, transform: [{ translateX: -9 }] },
	'100%': { opacity: 1, transform: [{ translateX: 0 }] }
};

const panelAnimation = {
	...PANEL_KEYFRAMES['0%'],
	animationDuration: 190,
	animationFillMode: 'both' as const,
	animationName: PANEL_KEYFRAMES,
	animationTimingFunction: MENU_EASING
};

const levelAnimation = (isBack: boolean) => {
	const keyframes = isBack ? LEVEL_BACK_KEYFRAMES : LEVEL_IN_KEYFRAMES;

	return {
		...keyframes['0%'],
		animationDuration: 200,
		animationFillMode: 'both' as const,
		animationName: keyframes,
		animationTimingFunction: MENU_EASING
	};
};

/** Where the anchor sat when it was tapped, in window coordinates. */
interface AnchorFrame {
	height: number;
	right: number;
	y: number;
}

export const MenuAction = ({
	accessibilityLabel,
	assetName,
	icon,
	items,
	systemIcon,
	tone = 'accent'
}: MenuActionProps) => {
	const { theme } = useThemeContext();
	const glyphColor = tone === 'accent' ? theme.colors.accent : theme.colors.text;

	if (Platform.OS === 'ios' && swiftUi && swiftUiModifiers) {
		const { Button, Host, Image, Label, Menu, Picker, Text, Toggle } = swiftUi;
		const {
			accessibilityLabel: accessibilityLabelModifier,
			frame,
			menuActionDismissBehavior,
			tag,
			tint
		} = swiftUiModifiers;

		/** Our own glyph where it has been converted, Apple's where it hasn't. */
		const glyphFor = (item: MenuActionItem & { assetName?: string; systemIcon?: MenuActionProps['systemIcon'] }) =>
			item.assetName === undefined
				? { systemImage: item.systemIcon }
				: { icon: <Image assetName={item.assetName} /> };

		/*
		 * Each kind is the SwiftUI control that already behaves the way the row should, rather
		 * than a button dressed up as one — a `Toggle` in a menu keeps the menu open so several
		 * can be set in one visit, and a nested `Menu` is a submenu with the system's own
		 * chevron and transition. Building either out of `Button`s would have to imitate both.
		 */
		const renderItem = (item: MenuActionItem) => {
			// A section is drawn chrome — the eyebrow between two groups of rows. SwiftUI's menu
			// already separates a `Picker`'s options from what follows, so it carries nothing here.
			if (item.kind === 'section') {
				return null;
			}

			if (item.kind === 'toggle') {
				return (
					<Toggle
						key={item.label}
						isOn={item.isOn}
						label={item.label}
						/*
						 * **The menu stays open when one of these is tapped.** A menu dismisses on
						 * any action by default, including a `Toggle` — so setting both status
						 * filters meant opening the menu twice, and the second visit undid nothing
						 * but still cost two taps to reach.
						 *
						 * On the toggles alone, not the menu around them: a `choice` is answered
						 * once and a command is done once, so both should still close. This is
						 * also what the drawn path has always done, so the two now agree.
						 */
						modifiers={[menuActionDismissBehavior('disabled')]}
						onIsOnChange={item.onChange}
					/>
				);
			}

			if (item.kind === 'submenu') {
				return (
					<Menu key={item.label} label={<Label title={item.label} {...glyphFor(item)} />}>
						{item.items.map(renderItem)}
					</Menu>
				);
			}

			if (item.kind === 'choice') {
				return (
					<Picker
						key={item.label}
						label={item.label}
						onSelectionChange={item.onChange}
						selection={item.value}
					>
						{item.options.map(option => (
							<Text key={option.value} modifiers={[tag(option.value)]}>
								{option.label}
							</Text>
						))}
					</Picker>
				);
			}

			return (
				// The destructive role is the system's own red, the same one its alerts use.
				<Button
					key={item.label}
					onPress={item.onPress}
					{...(item.tone === 'destructive' ? { role: 'destructive' } : {})}
				>
					{/* `Label`'s `icon` slot takes a view, which is what lets a menu row carry one
					    of our converted symbols rather than Apple's nearest equivalent.
					    `systemImage` only accepts stock names. */}
					<Label title={item.label} {...glyphFor(item)} />
				</Button>
			);
		};

		return (
			/* Sized rather than measured, for the reason `GlassCornerAction` sets out: a
			   `matchContents` Host is 0×0 until its native view lays out, and the header is
			   measured to size the capsule around it. */
			<View style={styles.host}>
				<Host style={styles.host}>
					<Menu
						// The same bare 44pt box as `GlassCornerAction`, so the trigger sits in the
						// bar's rhythm rather than hugging its glyph. No `buttonStyle` to set here —
						// a `Menu`'s label draws no chrome of its own to begin with.
						label={
							<Image
								size={GLYPH_SIZE}
								{...(assetName === undefined ? { systemName: systemIcon } : { assetName })}
							/>
						}
						modifiers={[
							frame({ height: TARGET_SIZE, width: TARGET_SIZE }),
							tint(glyphColor),
							accessibilityLabelModifier(accessibilityLabel)
						]}
					>
						{items.map(renderItem)}
					</Menu>
				</Host>
			</View>
		);
	}

	return (
		<DrawnMenuAction accessibilityLabel={accessibilityLabel} glyphColor={glyphColor} icon={icon} items={items} />
	);
};

/**
 * The Android path — D4's two-level panel. Split into its own component because it holds state
 * and measures: keeping it inside `MenuAction` would put hooks behind the platform branch above.
 *
 * **A level replaces the one above it**, with a back row carrying the parent's name; the two
 * cards Slack shows side by side are a desktop layout and a phone-width panel cannot do it.
 * Which level is open is held here and cleared on close, so reopening always starts at the root.
 */
const DrawnMenuAction = ({
	accessibilityLabel,
	glyphColor,
	icon,
	items
}: {
	accessibilityLabel: string;
	glyphColor: string;
	icon: MenuActionProps['icon'];
	items: MenuActionItem[];
}) => {
	const { theme } = useThemeContext();
	const { width: windowWidth } = useWindowDimensions();
	const isReducedMotion = useReducedMotion();
	const anchorRef = useRef<View>(null);
	const [anchor, setAnchor] = useState<AnchorFrame | null>(null);
	const [openLabel, setOpenLabel] = useState<string | null>(null);
	/*
	 * Which way the current level arrived — it slides in from the right on the way down and from
	 * the left on the way back up, so the panel reads as one page turning rather than two menus
	 * taking turns. Held beside the level rather than derived from it, because by the time the
	 * new level renders the old one is gone.
	 */
	const [isBack, setIsBack] = useState(false);

	// A hint never puts its card over an open menu.
	useRegisterOpenOverlay(anchor !== null);

	/*
	 * Measured on every open rather than on layout: the bar this sits in is the navigator's, and
	 * a rotation or a keyboard moves it without the trigger re-rendering.
	 */
	const open = useCallback(() => {
		anchorRef.current?.measureInWindow((x, y, width, height) => {
			setAnchor({ height, right: windowWidth - (x + width), y });
		});
	}, [windowWidth]);

	const close = useCallback(() => {
		setAnchor(null);
		setOpenLabel(null);
		setIsBack(false);
	}, []);

	const descend = useCallback((label: string) => {
		setIsBack(false);
		setOpenLabel(label);
	}, []);

	const ascend = useCallback(() => {
		setIsBack(true);
		setOpenLabel(null);
	}, []);

	const submenu = items.find(
		(item): item is MenuActionSubmenu => item.kind === 'submenu' && item.label === openLabel
	);
	const level = submenu ? submenu.items : items;

	return (
		<View ref={anchorRef}>
			<Pressable
				accessibilityLabel={accessibilityLabel}
				accessibilityRole='button'
				onPress={open}
				style={({ pressed }) => [styles.trigger, { opacity: pressed ? 0.6 : 1 }]}
			>
				<Icon color={glyphColor} name={icon} size={GLYPH_SIZE} strokeWidth={1.9} />
			</Pressable>
			<Modal animationType='none' onRequestClose={close} transparent visible={anchor !== null}>
				{/* No scrim: an Android popup menu doesn't dim the screen behind it, and this app
				    is flat enough that the panel's shadow is what separates it. The backdrop is
				    here to catch the tap that dismisses, nothing more. */}
				<Pressable onPress={close} style={StyleSheet.absoluteFill} />
				{anchor === null ? null : (
					<Animated.View
						style={[
							styles.panel,
							{
								backgroundColor: theme.colors.surface,
								borderColor: theme.colors.border,
								shadowColor: theme.colors.text,
								// Hung from the anchor's right edge, which is the screen's right
								// edge in a toolbar — clamped so the panel can't run off it.
								right: Math.max(anchor.right, SCREEN_EDGE_INSET),
								top: anchor.y + anchor.height + ANCHOR_GAP
							},
							isReducedMotion ? null : panelAnimation
						]}
					>
						{/*
						 * Keyed on the level, so moving between them **remounts** the block and the
						 * slide plays from its opening frame each time. Re-rendered in place, a CSS
						 * animation that is already at 100% has nothing left to play.
						 */}
						<Animated.View
							key={openLabel ?? 'root'}
							style={isReducedMotion ? null : levelAnimation(isBack)}
						>
							{submenu ? (
								<>
									<DrawnRow
										icon='chevronLeft'
										iconColor={theme.colors.accent}
										label={submenu.label}
										onPress={ascend}
										style={styles.backRow}
									/>
									<DrawnDivider />
								</>
							) : null}
							{drawnRows(level, close, descend).map(row => {
								if (row.kind === 'eyebrow') {
									return (
										<View key={row.key}>
											{row.hasDivider ? <DrawnDivider /> : null}
											<EyebrowText color={theme.colors.faintText} style={styles.eyebrow}>
												{row.label}
											</EyebrowText>
										</View>
									);
								}

								// The spec's own bookkeeping stays out of the row's props — React refuses a
								// `key` arriving through a spread, and the other two are already consumed.
								const { hasDivider, key, kind: _kind, ...rowProps } = row;

								return (
									<View key={key}>
										{hasDivider ? <DrawnDivider /> : null}
										<DrawnRow {...rowProps} />
									</View>
								);
							})}
						</Animated.View>
					</Animated.View>
				)}
			</Modal>
		</View>
	);
};

type DrawnRowSpec =
	| { kind: 'eyebrow'; key: string; label: string; hasDivider: boolean }
	| ({ kind: 'row'; key: string; hasDivider: boolean } & DrawnRowProps);

/**
 * One level's items, flattened into the rows and eyebrows that draw it.
 *
 * A `choice` becomes **several** rows rather than one, laid out inline where it sits — which is
 * what SwiftUI does with a `Picker` in a menu, and the whole reason this returns a list per item
 * instead of a row per item. Without it the drawn menu would need a level the native one doesn't
 * have, and the two would stop being the same menu.
 *
 * A choice heads its options with its own label as an eyebrow — **unless it is the only thing on
 * the level**, where the back row above already says what the level is and a second "SIRALA"
 * under "Sırala" would say it twice. D4's sort level is exactly that case.
 *
 * A divider goes before every eyebrow that isn't first, and before a destructive command: those
 * are the two places D4 rules a line between groups.
 */
const drawnRows = (
	items: MenuActionItem[],
	close: () => void,
	openSubmenu: (label: string) => void
): DrawnRowSpec[] => {
	const isLoneChoice = items.length === 1 && items[0]?.kind === 'choice';
	const rows: DrawnRowSpec[] = [];
	const eyebrow = (key: string, label: string) => {
		rows.push({ hasDivider: rows.length > 0, key, kind: 'eyebrow', label });
	};

	for (const item of items) {
		if (item.kind === 'section') {
			eyebrow(`section:${item.label}`, item.label);
			continue;
		}

		if (item.kind === 'submenu') {
			rows.push({
				hasDivider: false,
				hasSubmenu: true,
				key: item.label,
				kind: 'row',
				label: item.label,
				onPress: () => openSubmenu(item.label),
				...(item.value === undefined ? {} : { value: item.value })
			});
			continue;
		}

		if (item.kind === 'toggle') {
			rows.push({
				hasDivider: false,
				isOn: item.isOn,
				isToggle: true,
				key: item.label,
				kind: 'row',
				label: item.label,
				// Deliberately does not close: several filters get set in one visit, same as
				// the native `Toggle`.
				onPress: () => item.onChange(!item.isOn)
			});
			continue;
		}

		if (item.kind === 'choice') {
			if (!isLoneChoice) {
				eyebrow(`choice:${item.label}`, item.label);
			}

			for (const option of item.options) {
				rows.push({
					hasDivider: false,
					isChoice: true,
					isOn: option.value === item.value,
					key: `${item.label}:${option.value}`,
					kind: 'row',
					label: option.label,
					// A choice answers one question; answering it closes the menu, as a native
					// `Picker` in a menu does.
					onPress: () => {
						close();
						item.onChange(option.value);
					}
				});
			}
			continue;
		}

		rows.push({
			hasDivider: item.tone === 'destructive',
			icon: item.icon,
			isDestructive: item.tone === 'destructive',
			key: item.label,
			kind: 'row',
			label: item.label,
			onPress: () => {
				close();
				item.onPress();
			}
		});
	}

	return rows;
};

interface DrawnRowProps {
	label: string;
	onPress: () => void;
	/** Opens a level: the value in force sits beside a chevron on the right. */
	hasSubmenu?: boolean;
	value?: string;
	/** A leading glyph — commands only; the back row passes its own colour. */
	icon?: IconName;
	iconColor?: string;
	/** Painted `danger`, label and glyph both. */
	isDestructive?: boolean;
	/** One of a choice's options: the label takes the accent and a tick when it is the one in force. */
	isChoice?: boolean;
	/** A toggle: a filled checkbox on the right, and the menu stays open. */
	isToggle?: boolean;
	isOn?: boolean;
	style?: object;
}

/**
 * One row of the drawn menu, in D4's four shapes — action, submenu, choice, toggle — told apart
 * by what sits at its right edge. Every one gets the same press feedback: the row's own fill
 * darkens under the finger, which is the prototype's `:active`.
 */
const DrawnRow = ({
	hasSubmenu = false,
	icon,
	iconColor,
	isChoice = false,
	isDestructive = false,
	isOn = false,
	isToggle = false,
	label,
	onPress,
	style,
	value
}: DrawnRowProps) => {
	const { theme } = useThemeContext();
	const labelColor = isDestructive
		? theme.colors.danger
		: (isChoice || isToggle) && isOn
		? theme.colors.accent
		: theme.colors.text;

	return (
		<Pressable
			accessibilityRole='menuitem'
			accessibilityState={isChoice || isToggle ? { checked: isOn } : undefined}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				pressed ? { backgroundColor: theme.colors.surfaceMuted } : null,
				style
			]}
		>
			{icon ? <Icon color={iconColor ?? labelColor} name={icon} size={ROW_GLYPH_SIZE} strokeWidth={1.9} /> : null}
			<Typography color={labelColor} numberOfLines={1} style={styles.rowLabel} variant='body' weight='semibold'>
				{label}
			</Typography>
			{hasSubmenu ? (
				<View style={styles.trailing}>
					{value === undefined ? null : (
						<Typography
							color={theme.colors.faintText}
							numberOfLines={1}
							style={styles.value}
							variant='caption'
						>
							{value}
						</Typography>
					)}
					<Icon color={theme.colors.faintText} name='chevronRight' size={CHEVRON_SIZE} strokeWidth={2} />
				</View>
			) : isToggle ? (
				<View
					style={[
						styles.toggleBox,
						{
							backgroundColor: isOn ? theme.colors.accent : theme.colors.transparent,
							borderColor: isOn ? theme.colors.accent : theme.colors.borderStrong
						}
					]}
				>
					{/* Laid out either way so the box's size never depends on its state; the tick
					    just isn't painted while it is off. */}
					<Icon
						color={isOn ? theme.colors.onAccent : theme.colors.transparent}
						name='check'
						size={TOGGLE_CHECK_SIZE}
						strokeWidth={3.2}
					/>
				</View>
			) : isChoice ? (
				<Icon
					color={isOn ? theme.colors.accent : theme.colors.transparent}
					name='check'
					size={ROW_GLYPH_SIZE}
					strokeWidth={2.4}
				/>
			) : null}
		</Pressable>
	);
};

const DrawnDivider = () => {
	const { theme } = useThemeContext();

	return <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />;
};

const styles = StyleSheet.create({
	/** The back row sits a touch off the divider under it. */
	backRow: {
		marginBottom: 2
	},
	divider: {
		height: 1,
		marginHorizontal: 10,
		marginVertical: 5
	},
	eyebrow: {
		fontSize: 10,
		letterSpacing: 1.4,
		paddingBottom: 5,
		paddingHorizontal: 12,
		paddingTop: 9
	},
	/** The same box the `frame` modifier pins inside, declared where RN's layout can see it. */
	host: {
		height: TARGET_SIZE,
		width: TARGET_SIZE
	},
	panel: {
		borderRadius: PANEL_RADIUS,
		borderWidth: 1,
		elevation: 12,
		padding: PANEL_PADDING,
		position: 'absolute',
		shadowOffset: { height: 20, width: 0 },
		shadowOpacity: 0.2,
		shadowRadius: 23,
		// Grows out of the corner it hangs from — the top right, where the trigger is.
		transformOrigin: 'top right',
		width: MENU_WIDTH
	},
	row: {
		alignItems: 'center',
		borderRadius: ROW_RADIUS,
		flexDirection: 'row',
		gap: 10,
		minHeight: ROW_MIN_HEIGHT,
		paddingHorizontal: 12,
		paddingVertical: 10
	},
	rowLabel: {
		flex: 1,
		fontSize: 12.5
	},
	toggleBox: {
		alignItems: 'center',
		borderRadius: TOGGLE_BOX_RADIUS,
		borderWidth: 1.5,
		height: TOGGLE_BOX_SIZE,
		justifyContent: 'center',
		width: TOGGLE_BOX_SIZE
	},
	trailing: {
		alignItems: 'center',
		flexDirection: 'row',
		flexShrink: 1,
		gap: 6
	},
	trigger: {
		alignItems: 'center',
		height: TARGET_SIZE,
		justifyContent: 'center',
		width: TARGET_SIZE
	},
	value: {
		flexShrink: 1,
		fontSize: 11.5
	}
});
