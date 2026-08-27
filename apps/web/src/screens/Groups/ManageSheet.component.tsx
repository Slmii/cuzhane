import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { DangerConfirmButton } from '@/components/ui/DangerConfirmButton/DangerConfirmButton.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useDeleteGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import type { GroupDetail } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';

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

	// Owner-only: a member's way out is "Gruptan ayrıl" on the group screen (07d), not
	// buried in a sheet they can't open.
	const handleDelete = () =>
		deleteGroup.mutate(group.id, {
			onSuccess: () => navigation.navigate('Tabs', { screen: 'Groups' })
		});

	const spotsHint = `${group.memberCount} / ${group.spots} · ${group.spotsLeft} ${t('spotsLeft')}`;

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose} title={t('manage')}>
			<CardSurface isFlush style={styles.card}>
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
			</CardSurface>

			<DangerConfirmButton
				confirmLabel={t('deleteConfirm')}
				hint={t('deleteHint')}
				isDisabled={deleteGroup.isPending}
				label={t('deleteGroup')}
				onConfirm={handleDelete}
			/>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: 12
	}
});
