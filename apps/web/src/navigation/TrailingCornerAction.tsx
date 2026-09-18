import { ProfileCornerAction } from '@/navigation/ProfileCornerAction';
import { SearchCornerAction } from '@/navigation/SearchCornerAction';
import { Platform } from 'react-native';

/**
 * The item at the right end of every bar — **the account on iOS, search on Android.** The two
 * platforms put search and the account in opposite places: iOS 26 gives search its own
 * detached button in the tab bar (`role: 'search'`) and reaches the account from the top, while
 * Material keeps the navigation bar for destinations, so Profil takes the fifth tab there and
 * search becomes the top bar's action. One component at the call sites, so a toolbar never has
 * to know which platform's arrangement it is drawing.
 *
 * **It carried a notification bell beside the account for a while and does not any more.** The
 * inbox is the bell *tab* now, which is where a bell belongs; a second one on all eleven bars
 * was one permanent item too many beside the account.
 */
interface TrailingCornerActionProps {
	/**
	 * The bar is Ana sayfa's, floating over H1's coloured layer — the glyph goes white in both
	 * themes there, whichever of the two items this platform draws.
	 */
	isOnHeaderSurface?: boolean;
}

export const TrailingCornerAction = ({ isOnHeaderSurface = false }: TrailingCornerActionProps) =>
	Platform.OS === 'android' ? (
		<SearchCornerAction isOnHeaderSurface={isOnHeaderSurface} />
	) : (
		<ProfileCornerAction isOnHeaderSurface={isOnHeaderSurface} />
	);
