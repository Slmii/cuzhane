import { UpdateCheckState, useInitialUpdateState } from '@/lib/hooks/useInitialUpdateState';
import { SplashScreen as AnimatedSplash } from '@/screens/Splash/SplashScreen.component';
import { reloadAsync } from 'expo-updates';
import { useEffect } from 'react';
import type { CheckForUpdateOnLaunchProps } from './CheckForUpdateOnLaunch.types';

/**
 * How long the launch waits for the check before giving up on it. The reference's own number,
 * and a **ceiling rather than a typical wait** — on any working connection the answer arrives in
 * well under a second, and on none at all the native check fails fast rather than hanging.
 */
export const UPDATE_CHECK_TIMEOUT_MS = 10_000;

/**
 * Stands in front of the app while the launch's OTA check resolves, and reloads into the new
 * bundle if one is waiting.
 *
 * **Ported from `brentvatne/microfoam-app`**, which is what Expo point at when asked how to apply
 * an update sooner than the next launch. Its `_layout.tsx` renders this instead of the app until
 * `onComplete` fires; `AppRoot` does the same.
 *
 * **Why not `fallbackToCacheTimeout`.** That is the obvious knob and Expo advise against it: it
 * holds the splash for the *full* timeout on a bad connection, so the people it punishes hardest
 * are the ones with the worst network. Doing it here instead is what puts the deadline, the
 * fallback and the UI under our own control.
 *
 * **It starts no check of its own** — see `useInitialUpdateState`. Without any of this the app
 * launches its embedded bundle, downloads in the background and applies on the *next* launch,
 * which is `expo-updates`' default and why a freshly installed build never has the newest JS
 * until you reopen it.
 *
 * **The reference leaves "put your beautiful loading UI here" as a spinner; this app already has
 * one.** Rendering `AnimatedSplash` means the check happens behind the brand animation that was
 * going to play anyway, so on a good connection it costs nothing at all — and there is no seam,
 * because what replaces this component is the same splash still running out its minimum.
 */
export const CheckForUpdateOnLaunch = ({ onComplete, timeout }: CheckForUpdateOnLaunchProps) => {
	const state = useInitialUpdateState({ timeout: timeout ?? UPDATE_CHECK_TIMEOUT_MS });

	useEffect(() => {
		if (state === UpdateCheckState.UpdateReady) {
			/*
			 * Deferred a frame, as the reference does: this runs from an effect reacting to a
			 * state change, and tearing the app down inside that commit is not something to find
			 * out about in production.
			 */
			requestAnimationFrame(() => {
				void reloadAsync();
			});

			return;
		}

		if (state === UpdateCheckState.Timeout) {
			onComplete({ timedOut: true });

			return;
		}

		if (
			[
				UpdateCheckState.NoUpdateAvailable,
				UpdateCheckState.Error,
				UpdateCheckState.NoEventsAfterInitialized,
				UpdateCheckState.NativeStateInitialized
			].includes(state)
		) {
			onComplete();
		}

		// Anything else is still in flight.
	}, [onComplete, state]);

	return <AnimatedSplash />;
};
