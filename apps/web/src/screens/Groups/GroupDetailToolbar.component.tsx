import { useTourBarTarget } from '@/components/Tour/useTourBarTarget';
import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { groupQueryKeys } from '@/lib/hooks/queryKeys';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupSummary } from '@/lib/types/domain';
import { TrailingCornerAction } from '@/navigation/TrailingCornerAction';
import type { TabStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

/**
 * The group screen's two whole-group actions, in the navigator's bar.
 *
 * **Registered by the navigator, not set from the screen's effect.** `setOptions` runs after the
 * screen's first commit, so the bar arrived a beat late and the controls visibly appeared over a
 * screen that was already drawn. In `options` they are part of the header from the first frame.
 *
 * The cost is that a header lives outside the screen and can reach none of its state, which is
 * what the two lookups here replace: `isOwner` comes from the query cache the screen is already
 * holding, and opening a sheet goes through the route's `sheet` param rather than `setSheet`.
 *
 * Owners get settings; a member has no settings to open, so that slot carries the one thing the
 * settings sheet held for them — the members list — rather than sitting empty. It is the only
 * way in now that the "Bu grupta kimler var" row is gone.
 */
type GroupDetailNavigationProp = NativeStackNavigationProp<TabStackParamList, 'GroupDetail'>;

export const GroupDetailToolbar = () => {
	const navigation = useNavigation<GroupDetailNavigationProp>();
	const { groupId } = useRoute<RouteProp<TabStackParamList, 'GroupDetail'>>().params;
	const { t } = useTranslation();
	// The same query key the screen holds, so this reads what is already cached rather than
	// fetching a second time.
	const { data: group } = useGetGroupById(groupId);
	/*
	 * **Seeded from the shelf while the detail loads.** Arriving from Gruplarım the detail query
	 * is its own key and starts pending, so an owner got the members glyph for as long as the
	 * request took and watched it turn into the gear. The shelf's summary already carries
	 * `isOwner` and is already in the cache, so the first frame can be right.
	 *
	 * Read straight off the cache rather than through `useGetGroups`: subscribing here would
	 * fetch the whole shelf on a screen reached by deep link, to decide one glyph. It is only a
	 * seed — once the detail resolves it is the answer.
	 */
	// Stop 9 of the first-use tour — the share glyph, beside the account.
	useTourBarTarget('share', 1);

	const shelf = useQueryClient().getQueryData<GroupSummary[]>(groupQueryKeys.groups());
	const individual = group?.hizbIndividual ?? shelf?.find(entry => entry.id === groupId)?.hizbIndividual ?? false;
	const isOwner = group?.isOwner ?? shelf?.find(entry => entry.id === groupId)?.isOwner ?? false;

	return (
		<View style={styles.actions}>
			{isOwner ? (
				<GlassCornerAction
					accessibilityLabel={t('manage')}
					assetName='ayarlar-settings'
					icon='settings'
					onPress={() => navigation.setParams({ sheet: 'manage' })}
					tone='surface'
				/>
			) : (
				<GlassCornerAction
					accessibilityLabel={t('whoIsIn')}
					assetName='uyeler-members'
					icon='members'
					onPress={() => navigation.setParams({ sheet: 'members' })}
					tone='surface'
				/>
			)}
			{/*
			 * `surface` like the one beside it, not the accent. A toolbar is a row of monochrome
			 * glyphs next to the platform's own back control, so a sage share read as a coloured
			 * outlier rather than as the more important of the two — the same call already made
			 * for Gruplarım's +.
			 */}
			{!individual ? (
				<GlassCornerAction
					accessibilityLabel={t('share')}
					assetName='paylas-share'
					icon='share'
					onPress={() => navigation.setParams({ sheet: 'share' })}
					tone='surface'
				/>
			) : null}
			<TrailingCornerAction />
		</View>
	);
};

const styles = StyleSheet.create({
	actions: {
		flexDirection: 'row',
		/*
		 * No gap: each action is a 44pt box already, which is a toolbar's own rhythm — items
		 * sit flush and the space between the glyphs is the boxes, not a margin. A gap on top
		 * of that pushed them apart inside the capsule iOS groups them into.
		 */
		gap: 0
	}
});
