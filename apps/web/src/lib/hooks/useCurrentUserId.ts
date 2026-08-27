import { useAuth } from '@clerk/expo';

/**
 * The user id the API will attribute this session's writes to — the id screens compare
 * against when they ask "is this bab mine?". Null until Clerk has a session.
 */
export const useCurrentUserId = () => {
	const { userId } = useAuth();

	return userId ?? null;
};
