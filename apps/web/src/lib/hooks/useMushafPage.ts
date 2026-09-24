import { API_BASE_URL } from '@/lib/constants';
import { mushafQueryKeys } from '@/lib/hooks/queryKeys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * A Hüsrev mushaf page as a file on this device, fetched the first time it is opened.
 *
 * **Downloaded once, then kept**, in the cache directory: a page never changes, so after a cüz
 * has been read it opens offline and instantly. The OS may clear the cache under pressure,
 * which costs a re-download and nothing else. 91 MB for the whole mushaf is too much to bundle,
 * and about 3 MB for a cüz is a fair wait on first opening.
 *
 * **Written under a `.part` name and moved into place.** On Android a download streams straight
 * into its destination, so one that fails halfway leaves half a PNG behind — and a later open
 * would find the file, trust it, and draw a torn page forever. Only a finished file is ever
 * named `page-NNN.png`.
 */
const pagesDirectory = () => new Directory(Paths.cache, 'mushaf');

const ensurePage = async (path: string): Promise<string> => {
	// The web build has no file system to keep a page in — Expo's is a stub there — and the
	// browser caches the image by its own headers, which the server sets to a year.
	if (Platform.OS === 'web') {
		return `${API_BASE_URL}${path}`;
	}

	const name = path.slice(path.lastIndexOf('/') + 1);
	const directory = pagesDirectory();
	const file = new File(directory, name);

	if (file.exists) {
		return file.uri;
	}

	directory.create({ idempotent: true, intermediates: true });

	const partial = await File.downloadFileAsync(`${API_BASE_URL}${path}`, new File(directory, `${name}.part`), {
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
