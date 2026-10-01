import { TourTarget } from '@/components/Tour/TourTarget.component';
import { MenuAction } from '@/components/ui/MenuAction/MenuAction.component';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupsScreenParams, TabDetailParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { GroupBrowseMenu } from '@/components/GroupBrowseBar/GroupBrowseMenu.component';
import { TrailingCornerAction } from '@/navigation/TrailingCornerAction';

/**
 * Composed rather than taken from `TabStackParamList`, whose `Groups` is the **tab's** params —
 * a nested navigator state, not this screen's. `setParams` has to be typed against the screen's
 * own, which is the same reason `GroupsScreen` narrows its `useRoute` by hand.
 */
type GroupsToolbarNavigationProp = NativeStackNavigationProp<
	TabDetailParamList & { CreateGroup: undefined; Groups: GroupsScreenParams },
	'Groups'
>;

/**
 * Gruplarım's bar: one + that pulls down the ways in — a new group, a group's code, and a live
 * reading's code.
 *
 * **A component the navigator registers, not a `setOptions` call from the screen.** Setting the
 * header from an effect means the screen's first frame has no bar and a later commit puts one
 * there — visible as the control appearing a beat after the list. Registered in `options` it is
 * part of the header from the first render, which is also why it takes nothing from the screen:
 * a prop would drag it back into an effect.
 *
 * It reads the shelf from the query cache instead. `useGetGroups` is the same key the screen
 * holds, so this mounts against data that is already there rather than fetching a second time.
 */
export const GroupsToolbar = () => {
	const navigation = useNavigation<GroupsToolbarNavigationProp>();
	const { t } = useTranslation();
	const { data: groups, isError, isPending } = useGetGroups();

	// Nothing on the shelf: the design drops the bar entirely, because the empty state already
	// offers these same two errands as full-width buttons. Kept in step with `GroupsScreen`'s
	// own `isEmpty` — a bar over nothing is a control with no subject.
	// An empty shelf has nothing to narrow or add to; the account stays.
	if (!isPending && !isError && (!groups || groups.length === 0)) {
		return <TrailingCornerAction />;
	}

	return (
		<View style={styles.actions}>
			{/* Narrowing first, then adding, then the account at the end — the order the shelf is read in. */}
			<GroupBrowseMenu />
			{/*
			 * T3 of the tour: both ways into a group — a new one, or a private one by its code — are
			 * here. A disc around a disc: the 44pt glyph and the spotlight's 6pt either side.
			 */}
			<TourTarget id='newGroup' radius={28}>
				<MenuAction
					accessibilityLabel={t('addGroup')}
					assetName='yeni-new'
					icon='plus'
					items={[
						{
							assetName: 'yeni-new',
							icon: 'plus',
							label: t('newGroup'),
							onPress: () => navigation.navigate('CreateGroup')
						},
						{
							assetName: 'anahtar-key',
							icon: 'key',
							label: t('haveCode'),
							// The route param Onboarding already uses to ask for this sheet, rather than a
							// second channel: the screen clears it on dismissal, so one flag can serve both.
							onPress: () => navigation.setParams({ shouldOpenJoinSheet: true })
						},
						{
							// A live reading's code, asked for on its own — the same sheet, in its live mode.
							assetName: 'birlikte-oku-live-session',
							icon: 'liveSession',
							label: t('liveJoinMenu'),
							onPress: () => navigation.setParams({ shouldOpenLiveJoinSheet: true })
						}
					]}
					// `text`, not the accent: this sits beside the platform's own back chevron and
					// toolbar glyphs, which are monochrome. A sage + read as a coloured outlier.
					tone='surface'
				/>
			</TourTarget>
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
