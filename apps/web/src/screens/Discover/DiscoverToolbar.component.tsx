import { GroupBrowseMenu } from '@/components/GroupBrowseBar/GroupBrowseMenu.component';
import { TrailingCornerAction } from '@/navigation/TrailingCornerAction';
import { StyleSheet, View } from 'react-native';

/**
 * Keşfet's bar: the browse menu, then the account at the right end — the same arrangement as
 * Gruplarım's `GroupsToolbar`, registered in `AppNavigator`'s `options` for the same reason.
 */
export const DiscoverToolbar = () => (
	<View style={styles.actions}>
		<GroupBrowseMenu />
		<TrailingCornerAction />
	</View>
);

const styles = StyleSheet.create({
	actions: {
		flexDirection: 'row'
	}
});
