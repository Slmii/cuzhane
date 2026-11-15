import { authorizationHeader } from '@/api/wrapper.api';
import { API_BASE_URL } from '@/lib/constants';
import { mushafQueryKeys } from '@/lib/hooks/queryKeys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect } from 'react';
import { Platform } from 'react-native';

const pagesDirectory = () => new Directory(Paths.cache, 'mushaf');

/*
 * **A page download waits for the session only briefly.** Offline, Clerk's `getToken` keeps
 * retrying for minutes before it gives up, and an uncached page sat spinning all that time
 * instead of offering Tekrar dene. Past this, the download fails like any other.
 */
const TOKEN_TIMEOUT_MS = 8000;

const pageAuthorization = () =>
	Promise.race([
		authorizationHeader(),
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('No session for the page download')), TOKEN_TIMEOUT_MS)
		)
	]);

/**
 * Web only: the object URL each page was drawn from, kept so a page opened again reuses it
 * rather than minting another blob that nothing ever frees. Released when the page is
 * redownloaded.
 */
const webPageUrls = new Map<string, string>();

const ensurePage = async (path: string): Promise<string> => {
	if (Platform.OS === 'web') {
		const kept = webPageUrls.get(path);

		if (kept) {
			return kept;
		}

		const response = await fetch(`${API_BASE_URL}${path}`, { headers: await pageAuthorization() });

		if (!response.ok) {
			throw new Error(`Page ${path} answered ${response.status}`);
		}

		const url = URL.createObjectURL(await response.blob());

		webPageUrls.set(path, url);

		return url;
	}

	const name = path.slice(path.lastIndexOf('/') + 1);
	const directory = pagesDirectory();
	const file = new File(directory, name);

	if (file.exists) {
		return file.uri;
	}

	directory.create({ idempotent: true, intermediates: true });

	const headers = await pageAuthorization();

	const partial = await File.downloadFileAsync(`${API_BASE_URL}${path}`, new File(directory, `${name}.part`), {
		headers,
		idempotent: true
	});

	await partial.move(file);

	return file.uri;
};

const pageQuery = (path: string) => ({
	queryFn: () => ensurePage(path),
	queryKey: mushafQueryKeys.page(path),
	// A page only goes bad if the OS clears the cache under it, and then the image fails and
	// `redownload` fetches it afresh — nothing is gained by asking again on focus or on a timer.
	staleTime: Infinity
});

/**
 * The page's local URI, and the next page fetched behind it so turning to it is instant.
 * Pages go by their served path (`mushafPagePath`, `MUSHAF_DUA_PATHS`), so the Hatim duası's
 * pages are kept exactly as the mushaf's are. `nextPath` is `undefined` on a cüz's last page.
 *
 * `redownload` is for an image that failed to draw: it deletes the file and **resets** the
 * query rather than refetching it. A refetch keeps the old URI on screen while it runs and,
 * failing, still has it — so a failed re-download hid the error behind a blank image.
 */
export const useMushafPage = (path: string, nextPath: string | undefined) => {
	const queryClient = useQueryClient();
	const query = useQuery(pageQuery(path));

	useEffect(() => {
		if (nextPath !== undefined) {
			void queryClient.prefetchQuery(pageQuery(nextPath));
		}
	}, [nextPath, queryClient]);

	const redownload = () => {
		const kept = webPageUrls.get(path);

		if (kept) {
			URL.revokeObjectURL(kept);
			webPageUrls.delete(path);
		}

		if (query.data && Platform.OS !== 'web') {
			try {
				new File(query.data).delete();
			} catch {
				// Already gone — which is the usual reason it failed to draw.
			}
		}

		void queryClient.resetQueries({ queryKey: mushafQueryKeys.page(path) });
	};

	return { ...query, redownload };
};
