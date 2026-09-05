import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type TabNavigationProp = NativeStackNavigationProp<TabStackParamList>;

interface SearchCornerActionProps {
	/** Ana sayfa's bar floats over the coloured layer — see `GlassCornerAction`. */
	isOnHeaderSurface?: boolean;
}

/**
 * Android's way into search: the Material "search action" at the right end of the top bar.
 * Search is a mode, not a destination, so on Android it does not take a tab — Material keeps
 * the navigation bar for places and puts search at the top, which is where Gmail, Play and
 * Files all keep it. `Search` is registered in every tab's stack there, so it pushes inside the
 * tab you are on and the system back returns you to it.
 */
export const SearchCornerAction = ({ isOnHeaderSurface = false }: SearchCornerActionProps) => {
	const navigation = useNavigation<TabNavigationProp>();
	const { t } = useTranslation();

	return (
		<GlassCornerAction
			accessibilityLabel={t('search')}
			icon='search'
			isOnHeaderSurface={isOnHeaderSurface}
			onPress={() => navigation.navigate('Search')}
			systemIcon='magnifyingglass'
			tone='surface'
		/>
	);
};
