import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { SFSymbol } from 'sf-symbols-typescript';

interface MenuActionGlyph {
	/** What the drawn path renders, always from our own `ui/Icon`. */
	icon: IconName;
	/**
	 * A custom SF Symbol from `scripts/build-symbols.mjs`, drawn beside the row in the native
	 * menu. Preferred over `systemIcon`, so the glyph is ours on both paths.
	 */
	assetName?: string;
	systemIcon?: SFSymbol;
}

/** A row that does something and closes the menu. */
export interface MenuActionCommand extends MenuActionGlyph {
	kind?: 'command';
	label: string;
	onPress: () => void;
}

/**
 * A row that is on or off, and **leaves the menu open** so several can be set in one visit —
 * `menuActionDismissBehavior('disabled')` on iOS, and simply not closing on the drawn path.
 */
export interface MenuActionToggle extends MenuActionGlyph {
	kind: 'toggle';
	label: string;
	isOn: boolean;
	onChange: (isOn: boolean) => void;
}

/**
 * A row that opens a **submenu of mutually exclusive options**, with a tick against the one in
 * force — the shape Slack uses for "Sort by". Native menus render this from a `Picker`, which is
 * why the options carry a `value` rather than a callback each.
 */
export interface MenuActionChoice extends MenuActionGlyph {
	kind: 'choice';
	label: string;
	value: string;
	options: { label: string; value: string }[];
	onChange: (value: string) => void;
}

/**
 * A row that opens a **nested menu** of its own — the "Filtrele ›" / "Sırala ›" shape.
 *
 * Distinct from `choice`, and both are needed. A `choice` is one question with one answer and
 * renders _inline_ where it sits (SwiftUI draws a `Picker` in a menu as a ticked section, not as
 * a submenu); a `submenu` is a level, and can hold several questions at once. Filtering is two
 * questions — cadence and status — so it is a submenu containing a choice and two toggles.
 */
export interface MenuActionSubmenu extends MenuActionGlyph {
	kind: 'submenu';
	label: string;
	items: MenuActionItem[];
}

export type MenuActionItem = MenuActionCommand | MenuActionToggle | MenuActionChoice | MenuActionSubmenu;

export interface MenuActionProps {
	/** Spoken label for the trigger — it is a glyph, so it has no visible text. */
	accessibilityLabel: string;
	/** The trigger's glyph on the drawn path. */
	icon: IconName;
	/** The trigger's glyph on the native path — see `MenuActionGlyph`. */
	assetName?: string;
	systemIcon?: SFSymbol;
	items: MenuActionItem[];
	tone?: 'accent' | 'surface';
}
