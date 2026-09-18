import { useUpdates } from 'expo-updates';
import { useEffect, useState } from 'react';

/**
 * Where the launch's OTA check has got to.
 *
 * **Ported from Brent Vatne's `useInitialUpdateState`** in `brentvatne/microfoam-app`, which is
 * what Expo point at when asked how to apply an update sooner than the next launch.
 *
 * The idea that makes it work, and the one an obvious implementation misses: it **observes** the
 * check `expo-updates` already runs on launch rather than starting one. `checkAutomatically`
 * defaults to `ON_LOAD`, so by the time any React code runs, the native module is already
 * checking — calling `checkForUpdateAsync()` yourself puts a second check and a second download
 * beside it. `useUpdates` is a view onto the native state machine, so this only has to read it.
 */
export enum UpdateCheckState {
	Unknown = 'Unknown',
	NativeStateInitialized = 'NativeStateInitialized',
	NoEventsAfterInitialized = 'NoEventsAfterInitialized',
	InProgress = 'InProgress',
	UpdateReady = 'UpdateReady',
	NoUpdateAvailable = 'NoUpdateAvailable',
	Error = 'Error',
	Timeout = 'Timeout'
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** The states that end the run — once in one of these, nothing moves it back. */
const TERMINAL_STATES = [
	UpdateCheckState.UpdateReady,
	UpdateCheckState.NoUpdateAvailable,
	UpdateCheckState.Error,
	UpdateCheckState.Timeout
];

const delayedStateUpdate = (fn: () => void, timeoutMs: number) => {
	const timeoutId = setTimeout(fn, timeoutMs);

	return () => clearTimeout(timeoutId);
};

export const useInitialUpdateState = (options?: { timeout?: number }): UpdateCheckState => {
	const {
		isChecking,
		isDownloading,
		isUpdatePending,
		isUpdateAvailable,
		downloadError,
		downloadedUpdate,
		checkError,
		lastCheckForUpdateTimeSinceRestart
	} = useUpdates();
	const [updateCheckState, setUpdateCheckState] = useState<UpdateCheckState>(UpdateCheckState.Unknown);

	/*
	 * **State set from an effect, deliberately.** `react-hooks/set-state-in-effect` is on in this
	 * repo and right nearly always — but this effect's whole job is to mirror an external system
	 * into React, which is the case the rule exists to make an exception for. The source is the
	 * native updates state machine, reached through `useUpdates`; there is nothing to derive
	 * during render because the events arrive from outside React entirely.
	 */
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (TERMINAL_STATES.includes(updateCheckState)) {
			return;
		}

		if (isUpdatePending || downloadedUpdate) {
			setUpdateCheckState(UpdateCheckState.UpdateReady);
		} else if (checkError || downloadError) {
			setUpdateCheckState(UpdateCheckState.Error);
		} else if (
			(isChecking || isDownloading || (!isDownloading && isUpdateAvailable)) &&
			updateCheckState !== UpdateCheckState.InProgress
		) {
			setUpdateCheckState(UpdateCheckState.InProgress);
		} else if (
			!isChecking &&
			!isDownloading &&
			!isUpdateAvailable &&
			updateCheckState === UpdateCheckState.InProgress
		) {
			setUpdateCheckState(UpdateCheckState.NoUpdateAvailable);
		} else if (lastCheckForUpdateTimeSinceRestart !== undefined && updateCheckState === UpdateCheckState.Unknown) {
			setUpdateCheckState(UpdateCheckState.NativeStateInitialized);

			// The native state initialised and then nothing followed it. The reference has never
			// seen this happen; it is a bail-out so a silent module cannot hold the run open.
			return delayedStateUpdate(() => setUpdateCheckState(UpdateCheckState.NoEventsAfterInitialized), 100);
		} else if (updateCheckState === UpdateCheckState.Unknown) {
			// No check is running at all — after a `reloadAsync`, or with `checkAutomatically`
			// off. One frame is enough to tell that nothing is coming.
			return delayedStateUpdate(() => setUpdateCheckState(UpdateCheckState.NoEventsAfterInitialized), 16);
		}

		return;
	}, [
		lastCheckForUpdateTimeSinceRestart,
		isChecking,
		isDownloading,
		isUpdatePending,
		isUpdateAvailable,
		updateCheckState,
		checkError,
		downloadError,
		downloadedUpdate
	]);
	/* eslint-enable react-hooks/set-state-in-effect */

	useEffect(
		() =>
			delayedStateUpdate(
				() => setUpdateCheckState(UpdateCheckState.Timeout),
				options?.timeout ?? DEFAULT_TIMEOUT_MS
			),
		// The deadline is set once, at mount, and must not restart if the caller re-renders.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);

	return updateCheckState;
};
