import { clerkClient } from '@clerk/express';

/** Used only when Clerk has nothing usable and the stored name is empty too. */
export const FALLBACK_DISPLAY_NAME = 'Member';

/**
 * How long a looked-up profile is trusted. A name or a picture changes rarely, and the cost
 * of being a minute stale is that somebody sees the old one for a minute — against a Clerk
 * round trip on every poll of a members list, which refreshes every 30 seconds per viewer.
 */
const TTL_MS = 60_000;
/** Clerk's own cap on `getUserList`; more than this has to be paged. */
const PAGE_SIZE = 100;

export type MemberProfile = {
	/** Null when Clerk has no usable name — the caller keeps whatever it stored. */
	displayName: string | null;
	imageUrl: string | null;
};

type Entry = MemberProfile & { storedAt: number };

/**
 * Bound on the cache. Nothing here is precious — every entry can be fetched again — so the
 * simplest safe policy is to drop what has expired once it grows past this, and to empty it
 * entirely if that isn't enough. Without a bound it holds an entry for every user the
 * process has ever served, which only ever grows.
 */
const MAX_ENTRIES = 5_000;

const cache = new Map<string, Entry>();

const isFresh = (entry: Entry, now: number) => now - entry.storedAt < TTL_MS;

const evictIfCrowded = (now: number) => {
	if (cache.size <= MAX_ENTRIES) {
		return;
	}

	for (const [userId, entry] of cache) {
		if (!isFresh(entry, now)) {
			cache.delete(userId);
		}
	}

	if (cache.size > MAX_ENTRIES) {
		cache.clear();
	}
};

/**
 * The same precedence `resolveDisplayName` applies to session claims, over a full user — and
 * the same refusal to fall back to an email address, which other members would then see.
 */
const nameOf = (user: { fullName: string | null; firstName: string | null }) =>
	user.fullName?.trim() || user.firstName?.trim() || null;

/**
 * Names and photos for a set of members, by user id.
 *
 * `GroupMember.displayName` is written once, when someone joins, from whatever their session
 * claims held at that moment — so a member who signed up before setting a name is stored as
 * "Member" and stays that way however many times they fill their profile in. Clerk is the
 * source of truth for who someone is; this reads it and lets the caller prefer it.
 *
 * **Best effort**: Clerk being slow or unreachable must not take a members list down with
 * it, so a failed lookup yields nulls and the caller falls back to what it stored. A stale
 * name is a cosmetic loss; a failed request is not.
 *
 * Only ever called from endpoints that already require membership. Names the app stored are
 * public to a group; photos are not part of the public shape at all — the invite preview and
 * Keşfet show names and counts, never faces, because someone deciding whether to join has
 * not yet been let in.
 */
/**
 * Drops one user's cached profile, so the next read of it goes back to Clerk.
 *
 * **For the one case where a minute of staleness is not acceptable: your own name.** The TTL
 * above is a good trade for everyone else's — a name changes rarely, and the cost of being a
 * minute behind is that somebody else sees the old one for a minute. It is a bad trade for
 * the person who has just changed theirs and gone looking for it, which is exactly when they
 * are looking. `POST /profile/refresh` calls this for the caller and nobody else; a client
 * cannot evict anyone's entry but its own.
 */
export const forgetMemberProfile = (userId: string): void => {
	cache.delete(userId);
};

export const getMemberProfiles = async (userIds: string[]): Promise<Map<string, MemberProfile>> => {
	const now = Date.now();

	evictIfCrowded(now);

	const wanted = [...new Set(userIds)];
	const profiles = new Map<string, MemberProfile>();
	const missing: string[] = [];

	for (const userId of wanted) {
		const entry = cache.get(userId);

		if (entry && isFresh(entry, now)) {
			profiles.set(userId, { displayName: entry.displayName, imageUrl: entry.imageUrl });
		} else {
			missing.push(userId);
		}
	}

	if (missing.length === 0) {
		return profiles;
	}

	try {
		for (let offset = 0; offset < missing.length; offset += PAGE_SIZE) {
			const page = missing.slice(offset, offset + PAGE_SIZE);
			const { data } = await clerkClient.users.getUserList({ userId: page, limit: PAGE_SIZE });

			for (const user of data) {
				// `hasImage` is false for the letter-avatar Clerk generates itself — which is a
				// placeholder like ours, and a worse one, since it isn't in the app's palette.
				const profile: MemberProfile = {
					displayName: nameOf(user),
					imageUrl: user.hasImage ? user.imageUrl : null
				};

				cache.set(user.id, { ...profile, storedAt: now });
				profiles.set(user.id, profile);
			}

			// Anyone Clerk didn't return is cached as unknown too, or a deleted account would be
			// looked up again on every single request.
			for (const userId of page) {
				if (!profiles.has(userId)) {
					const profile: MemberProfile = { displayName: null, imageUrl: null };

					cache.set(userId, { ...profile, storedAt: now });
					profiles.set(userId, profile);
				}
			}
		}
	} catch {
		/*
		 * Fall back to whatever was last known, expired or not. The TTL is about freshness, and
		 * a name from a minute ago is far closer to the truth than none: answering with nulls
		 * during a Clerk blip makes every photo vanish and every name revert to the value
		 * stored at join time, which is exactly the "Member" this lookup exists to replace.
		 */
		for (const userId of missing) {
			if (profiles.has(userId)) {
				continue;
			}

			const stale = cache.get(userId);

			profiles.set(userId, {
				displayName: stale?.displayName ?? null,
				imageUrl: stale?.imageUrl ?? null
			});
		}
	}

	return profiles;
};
