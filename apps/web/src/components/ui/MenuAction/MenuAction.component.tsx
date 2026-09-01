import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
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
/** The drawn menu's own metrics: the gap under the anchor, and how wide a two-word row needs. */
const ANCHOR_GAP = 6;
const MENU_MIN_WIDTH = 220;
const SCREEN_EDGE_INSET = 12;
/** A row's leading glyph, its tick and its submenu chevron are all this size. */
const ROW_GLYPH_SIZE = 20;

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
		const glyphFor = (item: MenuActionItem) =>
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
				<Button key={item.label} onPress={item.onPress}>
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
 * The Android path. Split into its own component because it holds state and measures: keeping it
 * inside `MenuAction` would put hooks behind the platform branch above.
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

	/*
	 * Measured on every open rather than on layout: the bar this sits in is the navigator's, and
	 * a rotation or a keyboard moves it without the trigger re-rendering.
	 */
	const open = useCallback(() => {
		anchorRef.current?.measureInWindow((x, y, width, height) => {
			setAnchor({ height, right: windowWidth - (x + width), y });
		});
	}, [windowWidth]);

	/*
	 * Which `submenu` row has been opened into, by label. A level **replaces** the one above
	 * rather than hanging off it, which is what a phone-width menu can actually do — the two
	 * cards Slack shows side by side are a desktop layout. Held here and cleared on close, so
	 * reopening always starts at the top.
	 */
	const [openLabel, setOpenLabel] = useState<string | null>(null);

	const close = useCallback(() => {
		setAnchor(null);
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
				    is flat enough that the card's border is what separates it. The backdrop is
				    here to catch the tap that dismisses, nothing more. */}
				<Pressable onPress={close} style={StyleSheet.absoluteFill} />
				{anchor === null ? null : (
					<Animated.View
						entering={isReducedMotion ? undefined : FadeIn.duration(120)}
						style={[
							styles.menu,
							{
								backgroundColor: theme.colors.surface,
								borderColor: theme.colors.border,
								borderRadius: theme.radius.md,
								// Hung from the anchor's right edge, which is the screen's right
								// edge in a toolbar — clamped so a wide row can't run off it.
								right: Math.max(anchor.right, SCREEN_EDGE_INSET),
								top: anchor.y + anchor.height + ANCHOR_GAP
							}
						]}
					>
						{/* The way back up. A level replaces its parent here, so without this the
						    only way out of one is dismissing the whole menu. */}
						{submenu ? (
							<DrawnRow
								icon='chevronLeft'
								index={0}
								label={submenu.label}
								onPress={() => setOpenLabel(null)}
							/>
						) : null}
						{/*
						 * `rows` flattens before it renders, because a `choice` contributes several
						 * rows rather than one — laid out inline under nothing, exactly as SwiftUI
						 * draws a `Picker` in a menu. Mapping items to rows one-for-one could not
						 * express that, and it is what keeps the two platforms the same shape.
						 */}
						{drawnRows(level, close, setOpenLabel).map(({ key, ...row }, index) => (
							<DrawnRow key={key} {...row} index={index + (submenu ? 1 : 0)} />
						))}
					</Animated.View>
				)}
			</Modal>
		</View>
	);
};

interface DrawnRowSpec {
	key: string;
	label: string;
	onPress: () => void;
	hasSubmenu?: boolean;
	icon?: IconName;
	isTicked?: boolean;
}

/**
 * One level's items, flattened into the rows that draw it.
 *
 * A `choice` becomes **several** rows rather than one, laid out inline where it sits — which is
 * what SwiftUI does with a `Picker` in a menu, and the whole reason this returns a list per item
 * instead of a row per item. Without it the drawn menu would need a level the native one doesn't
 * have, and the two would stop being the same menu.
 */
const drawnRows = (items: MenuActionItem[], close: () => void, openSubmenu: (label: string) => void): DrawnRowSpec[] =>
	items.flatMap((item): DrawnRowSpec[] => {
		if (item.kind === 'submenu') {
			return [
				{
					hasSubmenu: true,
					icon: item.icon,
					key: item.label,
					label: item.label,
					onPress: () => openSubmenu(item.label)
				}
			];
		}

		if (item.kind === 'toggle') {
			return [
				{
					icon: item.icon,
					isTicked: item.isOn,
					key: item.label,
					label: item.label,
					// Deliberately does not close: several filters get set in one visit, same as
					// the native `Toggle`.
					onPress: () => item.onChange(!item.isOn)
				}
			];
		}

		if (item.kind === 'choice') {
			return item.options.map(option => ({
				isTicked: option.value === item.value,
				key: `${item.label}:${option.value}`,
				label: option.label,
				onPress: () => item.onChange(option.value)
			}));
		}

		return [
			{
				icon: item.icon,
				key: item.label,
				label: item.label,
				onPress: () => {
					close();
					item.onPress();
				}
			}
		];
	});

/**
 * One row of the drawn menu. A tick sits in a slot that is **always laid out**, so the labels of
 * a submenu's options line up whether or not any of them is the one in force.
 */
const DrawnRow = ({
	hasSubmenu = false,
	icon,
	index,
	isTicked = false,
	label,
	onPress
}: {
	index: number;
	label: string;
	onPress: () => void;
	hasSubmenu?: boolean;
	icon?: IconName;
	isTicked?: boolean;
}) => {
	const { theme } = useThemeContext();

	return (
		<Pressable
			accessibilityRole='menuitem'
			onPress={onPress}
			style={({ pressed }) => [
				styles.item,
				index > 0 ? { borderTopColor: theme.colors.border, borderTopWidth: 1 } : null,
				pressed ? { backgroundColor: theme.colors.surfaceMuted } : null
			]}
		>
			<View style={styles.rowGlyph}>
				{icon ? (
					<Icon color={theme.colors.text} name={icon} size={ROW_GLYPH_SIZE} strokeWidth={1.6} />
				) : isTicked ? (
					<Icon color={theme.colors.accent} name='check' size={ROW_GLYPH_SIZE} strokeWidth={1.9} />
				) : null}
			</View>
			<Typography style={styles.rowLabel} variant='body'>
				{label}
			</Typography>
			{/* A toggle that is on shows its tick on the right, because its own glyph holds the
			    left slot. A choice shows where it leads. */}
			{icon && isTicked ? (
				<Icon color={theme.colors.accent} name='check' size={ROW_GLYPH_SIZE} strokeWidth={1.9} />
			) : hasSubmenu ? (
				<Icon color={theme.colors.faintText} name='chevronRight' size={ROW_GLYPH_SIZE} strokeWidth={1.6} />
			) : null}
		</Pressable>
	);
};

const styles = StyleSheet.create({
	/** The same box the `frame` modifier pins inside, declared where RN's layout can see it. */
	host: {
		height: TARGET_SIZE,
		width: TARGET_SIZE
	},
	item: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	/** Always laid out, so a submenu's labels line up whether or not a row is ticked. */
	rowGlyph: {
		alignItems: 'center',
		height: ROW_GLYPH_SIZE,
		width: ROW_GLYPH_SIZE
	},
	rowLabel: {
		flex: 1
	},
	menu: {
		borderWidth: 1,
		minWidth: MENU_MIN_WIDTH,
		overflow: 'hidden',
		position: 'absolute'
	},
	trigger: {
		alignItems: 'center',
		height: TARGET_SIZE,
		justifyContent: 'center',
		width: TARGET_SIZE
	}
});
