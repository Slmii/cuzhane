import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useDeleteGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import type { GroupDetail } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, StyleSheet, View } from 'react-native';

type Props = {
	group: GroupDetail;
	isVisible: boolean;
	onClose: () => void;
	onOpenMembers: () => void;
};

export const ManageSheet = ({ group, isVisible, onClose, onOpenMembers }: Props) => {
	const { t } = useTranslation();
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();

	const updateGroup = useUpdateGroup();
	const deleteGroup = useDeleteGroup();

	/**
	 * Owner-only: a member's way out is "Gruptan ayrıl" on the group screen (07d), not buried
	 * in a sheet they can't open. The two are otherwise the same errand and now behave the
	 * same way — platform dialog, then leave at once without waiting for the response.
	 *
	 * **Close the sheet before navigating.** It is a sibling of the screen being left rather
	 * than part of its stack, so a sheet left standing outlives the push and hangs over
	 * Gruplarım.
	 */
	const confirmDelete = () => {
		deleteGroup.mutate(group.id);
		onClose();
		/*
		 * By name — 'Groups' is the root of the Gruplarım stack, and navigating to a route
		 * already below you pops everything above it. `navigate('Tabs', { screen: 'Groups' })`
		 * was here before and only selected a tab that was usually already selected, which from
		 * the Gruplarım stack left you looking at the group you had just deleted.
		 */
		navigation.navigate('Groups');
	};

	/*
	 * The platform dialog, matching `LeaveGroupButton`. It replaced arm-and-tap-again, which
	 * asked twice without ever saying what would be lost at the moment of deciding — the hint
	 * was a line of small print under the button, and `deleteHint` now carries it as the
	 * dialog's body instead, where it is actually read.
	 */
	const handleDelete = () => {
		/*
		 * The destructive button repeats the title, like the leave dialog. The old two-tap
		 * button had its own armed label — "Emin misin? Sil" — and that is gone with it: a
		 * dialog whose title already asks and whose body states the cost would be asking twice
		 * in one breath.
		 */
		Alert.alert(t('deleteGroup'), t('deleteHint'), [
			{ style: 'cancel', text: t('cancel') },
			{ onPress: confirmDelete, style: 'destructive', text: t('deleteGroup') }
		]);
	};

	const spotsHint = `${group.memberCount} / ${group.spots} · ${group.spotsLeft} ${t('spotsLeft')}`;

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose} title={t('manage')}>
			<View style={styles.card}>
				<ToggleRow
					hint={spotsHint}
					onValueChange={next => updateGroup.mutate({ groupId: group.id, openToJoin: next })}
					title={t('openToJoin')}
					value={group.openToJoin}
				/>
				<Divider />
				<NavRow
					label={t('membersTitle')}
					meta={`${group.memberCount} / ${group.spots}`}
					onPress={onOpenMembers}
				/>
			</View>

			{/* No hint line: the dialog's body is the same sentence, said at the moment it matters.
			    `dangerFilled` rather than `danger` — this is the sheet's action, not one option
			    among several, and the drawn `danger` is a hairline over `surface`. */}
			<AppButton
				disabled={deleteGroup.isPending}
				onPress={handleDelete}
				title={t('deleteGroup')}
				variant='dangerFilled'
			/>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: 12
	}
});
