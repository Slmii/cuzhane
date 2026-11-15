import { useIsFocused } from '@react-navigation/native';
import { useEffect, useId } from 'react';
import { useHintsContext } from './Hints.context';
import type { HintScreen } from './hints';

/**
 * Says which screen is in front, for as long as it is: its hints play while it is focused (see
 * `HintsProvider`). **Focus, not mount** — the tabs are not lazy and pushed screens stack, so a
 * mounted screen is often one nobody can see.
 *
 * `null` is a screen in a state its hints are not for — a group not joined, still gathering, or a
 * plan not yet chosen. Nothing plays over it.
 */
export const useHintScreen = (screen: HintScreen | null) => {
	const { focusScreen } = useHintsContext();
	const isFocused = useIsFocused();
	const owner = useId();

	useEffect(() => {
		if (!isFocused || screen === null) {
			return;
		}

		focusScreen(owner, screen);

		return () => focusScreen(owner, null);
	}, [focusScreen, isFocused, owner, screen]);
};
