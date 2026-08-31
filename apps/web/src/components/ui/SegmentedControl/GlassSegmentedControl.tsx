import type { SegmentedControlProps } from './SegmentedControl.types';

/**
 * The non-iOS stand-in for `GlassSegmentedControl.ios.tsx`.
 *
 * It exists so the import in `SegmentedControl.component.tsx` resolves on every platform
 * without a conditional require at the call site. Nothing here ever renders: the flag is a
 * plain `false`, so the chooser picks the drawn control before reaching this.
 *
 * Deliberately importing nothing from `@expo/ui` — that is the entire point of the split. The
 * SwiftUI bridge resolves native views as its module loads, and Android has none of them.
 */
export const isGlassSegmentedControlAvailable = false;

export const GlassSegmentedControl = (_props: SegmentedControlProps) => null;
