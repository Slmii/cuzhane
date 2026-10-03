import { Alert } from 'react-native';

export type DestructiveConfirmRequest = {
	title: string;
	message: string;
	/** The word on the button that does the thing — "Sil", "Ayrıl", "Çıkar". */
	confirmLabel: string;
	cancelLabel: string;
	/**
	 * Whether the confirm button is styled as destroying something — red, and `destructive` on
	 * iOS. True for the four that do. **Signing out passes `false`**: it ends a session and takes
	 * nothing with it, and painting it the same red as "delete your account" would say it did.
	 */
	isDestructive?: boolean;
	onConfirm: () => void;
	/** Answered "no" — for a caller that was waiting on the answer to move on. */
	onCancel?: () => void;
};

/**
 * Set by `ui/DestructiveDialog`, which mounts once in `AppRoot` and only on Android. Null
 * everywhere else, which is what sends the call to `Alert.alert` below.
 */
let present: ((request: DestructiveConfirmRequest) => void) | null = null;

export const setDestructiveConfirmPresenter = (presenter: ((request: DestructiveConfirmRequest) => void) | null) => {
	present = presenter;
};

/**
 * "Are you sure?" for the five things worth asking about — delete a group, remove a member,
 * leave a group, delete an account, and sign out.
 *
 * **Imperative on purpose, because the call sites are.** Each is one line inside a callback, and
 * the native dialog underneath is a declarative component that has to be mounted and driven by
 * state. Holding that state per call site would mean five screens each tracking a pending
 * confirmation — and in the members list, *which member* is pending. So the mounted half lives
 * once in `AppRoot` and this is the door to it.
 *
 * **iOS keeps `Alert.alert`, and that is not laziness.** A `UIAlertController` presents at the
 * window level, so it works from inside a presented sheet — which is exactly why member removal
 * became an alert in the first place, iOS having refused to present a sheet over a sheet. Two
 * of the five callers are inside sheets. Swapping that for a SwiftUI dialog mounted at the root
 * would put the one reliable path back onto the fragile one for no gain: `Alert.alert` already
 * renders the platform's own alert there, with the destructive and cancel roles Apple defines.
 * It was tried, and it crashed — `ui/DestructiveDialog` records what went wrong.
 *
 * **Android is the half that needed replacing.** Its dialog has no destructive convention, so
 * `style: 'destructive'` has always been silently ignored there — the delete button looked
 * exactly like the cancel button on the screens where the difference matters most.
 *
 * One request at a time, and the last one wins: a second call while a dialog is open replaces
 * it, and the first caller is never told. Nothing in the app can raise two at once, so this is
 * recorded rather than guarded. What *is* guarded is answering one twice — see the host.
 */
export const confirmDestructive = (request: DestructiveConfirmRequest) => {
	if (present) {
		present(request);

		return;
	}

	Alert.alert(request.title, request.message, [
		{ onPress: request.onCancel, style: 'cancel', text: request.cancelLabel },
		{
			onPress: request.onConfirm,
			style: request.isDestructive === false ? 'default' : 'destructive',
			text: request.confirmLabel
		}
	]);
};
