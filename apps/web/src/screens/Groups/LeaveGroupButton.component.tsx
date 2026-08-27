import { DangerButton } from '@/components/ui/DangerButton/DangerButton.component';
import { useLeaveGroup } from '@/lib/hooks/useMembership';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import type { LeaveGroupButtonProps } from './LeaveGroupButton.types';

/**
 * 07d's way out, on both screens a member can be looking at: the running group and the
 * one still gathering.
 *
 * The confirmation is the platform dialog rather than the design's arm-and-tap-again
 * button. This sits in the open on a screen people scroll past, where a second stray tap
 * would be all it took — and leaving forfeits a seat that someone else can take before
 * you're back. The dialog also states the cost at the moment of deciding, which is the
 * one moment the hint under the button is not being read.
 */
export const LeaveGroupButton = ({ groupId, style }: LeaveGroupButtonProps) => {
	const { t } = useTranslation();
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();
	const leaveGroup = useLeaveGroup();

	const confirmLeave = () => {
		leaveGroup.mutate(groupId, {
			onSuccess: () => navigation.navigate('Tabs', { screen: 'Groups' })
		});
	};

	const handlePress = () => {
		Alert.alert(t('leaveGroup'), t('leaveHint'), [
			{ style: 'cancel', text: t('cancel') },
			{ onPress: confirmLeave, style: 'destructive', text: t('leaveGroup') }
		]);
	};

	return (
		<DangerButton
			hint={t('leaveHint')}
			isDisabled={leaveGroup.isPending}
			label={t('leaveGroup')}
			onPress={handlePress}
			style={style}
		/>
	);
};
