import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { setDestructiveConfirmPresenter, type DestructiveConfirmRequest } from '@/lib/utils/confirmDestructive';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * Material 3's alert dialog, wearing our palette — **the Android half only.**
 *
 * **iOS was tried here and reverted, because it crashed.** `@expo/ui`'s SwiftUI `Alert` was
 * mounted alongside this and tapping "Çıkış yap" or "Hesabı sil" took the app down. Two things
 * were wrong with it and only one is a typo:
 *
 * - `Alert.Message` and `Button` were handed bare strings. Every one of these is a native view,
 *   and a raw string child is what produced "Text strings must be rendered within a <Text>
 *   component" on Android — where it merely dropped the buttons. On a SwiftUI host it is fatal.
 * - The one that would have remained after fixing that: a SwiftUI alert is presented by the view
 *   controller owning the host, and this host lives at the root. With a sheet open that
 *   controller is *already presenting*, which UIKit refuses — and two of the five callers are
 *   inside sheets. `Alert.alert` has no such problem, because it presents at the window level.
 *   That is why member removal became an alert in the first place.
 *
 * So iOS stays on `Alert.alert`, which is already the platform's own alert with the destructive
 * and cancel roles Apple defines — it was never the half that needed replacing. Android was:
 * its dialog has no destructive convention, so `style: 'destructive'` was silently ignored and
 * the button that deletes your account looked exactly like the one that doesn't.
 *
 * Required behind a `Platform` check as well as a `try`, and the check is the part that matters:
 * `@expo/ui` ships one JavaScript module for both platforms, so the `require` resolves on iOS too
 * and only the *native* view is missing. Nothing throws until a dialog opens, and then it throws
 * from the mount dispatcher — which is how every sheet in the app broke once.
 */
type Compose = typeof import('@expo/ui/jetpack-compose');

let compose: Compose | null = null;

if (Platform.OS === 'android') {
	try {
		compose = require('@expo/ui/jetpack-compose') as Compose;
	} catch {
		compose = null;
	}
}

/**
 * Mounted once, in `AppRoot`, and renders nothing until something asks.
 *
 * **One host at the root, not a dialog per screen.** Android presents this in a window of its
 * own, above whatever is on screen rather than inside it, so a single instance serves all five
 * callers — two of which are inside bottom sheets and could not mount a dialog of their own
 * without putting a native host inside a presented sheet's surface.
 *
 * On iOS, and wherever the module doesn't resolve, the presenter is never registered and
 * `confirmDestructive` goes to React Native's `Alert.alert` — the same platform alert, minus the
 * colours Android needed.
 */
export const DestructiveDialog = () => {
	const { theme } = useThemeContext();
	const [request, setRequest] = useState<DestructiveConfirmRequest | null>(null);
	/**
	 * The same request, held where it can be **consumed synchronously**.
	 *
	 * `confirm` used to read the request off the render and call it after `setRequest(null)` — but
	 * that null only lands on the next commit, so two `onClick`s delivered in the same frame both
	 * saw a live request and both ran `onConfirm`. On these five buttons that is two delete-group
	 * or delete-account mutations from one double tap. Taking the callback out of the ref before
	 * invoking it makes the answer at-most-once whatever the native side delivers.
	 */
	const pendingRef = useRef<DestructiveConfirmRequest | null>(null);

	useEffect(() => {
		if (!compose) {
			return undefined;
		}

		setDestructiveConfirmPresenter(next => {
			pendingRef.current = next;
			setRequest(next);
		});

		return () => setDestructiveConfirmPresenter(null);
	}, []);

	// Answered "no" — the same once-only rule as `confirm` below.
	const dismiss = () => {
		const isCurrent = pendingRef.current === request;

		pendingRef.current = null;
		setRequest(null);

		if (isCurrent) {
			request?.onCancel?.();
		}
	};

	/*
	 * Answers only the request this render was drawn for. `request` is the one the buttons on
	 * screen belong to; `pendingRef` is whatever is live now. They differ in two cases, and both
	 * must be a no-op: a second tap on the same button (the ref is already null), and a newer
	 * request having replaced this one before its stale handler fired — without the check that
	 * tap would run B's `onConfirm` under A's title.
	 */
	const confirm = () => {
		if (pendingRef.current !== request) {
			return;
		}

		pendingRef.current = null;
		setRequest(null);
		request?.onConfirm();
	};

	if (!compose || !request) {
		return null;
	}

	const { AlertDialog, Host, Text, TextButton } = compose;

	return (
		// The host occupies nothing in the layout — the dialog it presents is a window of its own.
		<Host style={styles.host}>
			<AlertDialog
				colors={{
					containerColor: theme.colors.surface,
					textContentColor: theme.colors.subtext,
					titleContentColor: theme.colors.text
				}}
				onDismissRequest={dismiss}
			>
				<AlertDialog.Title>
					<Text>{request.title}</Text>
				</AlertDialog.Title>
				<AlertDialog.Text>
					<Text>{request.message}</Text>
				</AlertDialog.Text>
				{/*
				 * **The whole reason this exists on Android.** Material's dialog has no
				 * destructive convention, so `Alert.alert`'s `style: 'destructive'` did nothing
				 * here and the button that deletes your account looked exactly like the one that
				 * doesn't. Material's guidance is to colour it rather than to place it apart.
				 */}
				{/* Labels are wrapped in `Text`, not passed as bare strings: every one of these is
				    a native Compose view, and a raw string child is the "Text strings must be
				    rendered within a <Text> component" error — which drops the *buttons* while
				    the dialog itself still renders, so it fails as a dialog you cannot answer. */}
				<AlertDialog.ConfirmButton>
					<TextButton
						colors={{
							contentColor: request.isDestructive === false ? theme.colors.accent : theme.colors.danger
						}}
						onClick={confirm}
					>
						<Text>{request.confirmLabel}</Text>
					</TextButton>
				</AlertDialog.ConfirmButton>
				<AlertDialog.DismissButton>
					<TextButton colors={{ contentColor: theme.colors.subtext }} onClick={dismiss}>
						<Text>{request.cancelLabel}</Text>
					</TextButton>
				</AlertDialog.DismissButton>
			</AlertDialog>
		</Host>
	);
};

const styles = StyleSheet.create({
	host: {
		position: 'absolute'
	}
});
