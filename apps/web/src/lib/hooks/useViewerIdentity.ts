import { useUser } from '@clerk/expo';

/** The server's own fallback, in `utils/displayName.ts`. */
const FALLBACK_DISPLAY_NAME = 'Member';

export type ViewerIdentity = {
	/**
	 * What the server would call you — the client's copy of `resolveDisplayName`.
	 *
	 * It exists so a row can be drawn before the server has answered. Generated avatars are
	 * seeded on the member's name, so a row that guesses the seed wrong redraws as a
	 * different face the moment the real name arrives: taking a pool slot flipped the row to
	 * "Sen üstlendin" with one stranger's face, then swapped it for another.
	 *
	 * **The precedence has to match `apps/server/src/utils/displayName.ts`** — name, then
	 * first name, then the fallback, never the email — because the two are compared as strings.
	 */
	displayName: string;
	/**
	 * Your profile photo, if you have set one. The pool rows and the members list draw
	 * generated faces from a name, which is a stand-in for a picture — so where the picture
	 * is known it is used instead. Null when Clerk has none.
	 *
	 * Only ever *your* photo: the server sends other members' names but not their images, so
	 * everyone else keeps a generated face until it does.
	 */
	imageUrl: string | null;
};

export const useViewerIdentity = (): ViewerIdentity => {
	const { user } = useUser();

	const name = user?.fullName?.trim();
	const firstName = user?.firstName?.trim();

	return {
		displayName: name || firstName || FALLBACK_DISPLAY_NAME,
		imageUrl: user?.hasImage && user.imageUrl ? user.imageUrl : null
	};
};
