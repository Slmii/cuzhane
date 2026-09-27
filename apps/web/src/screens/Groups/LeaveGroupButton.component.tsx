import { AppButton } from '@/components/ui/Button/Button.component';
import { useLeaveGroup } from '@/lib/hooks/useMembership';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import type { LeaveGroupButtonProps } from './LeaveGroupButton.types';

/**
 * 07d's way out, on both screens a member can be looking at: the running group and the
 * one still gathering.
 *
 * The confirmation is the platform dialog rather than the design's arm-and-tap-again
 * button. This sits in the open on a screen people scroll past, where a second stray tap
 * would be all it took — and leaving forfeits a seat that someone else can take before
 * you're back.
 *
 * No `hint`, so no caption under the button. The dialog carries the same sentence as its
 * body and states the cost at the moment of deciding, which is the one moment it is
 * actually read; on the page it was three lines of small print under the last thing on the
 * screen. Deleting a group (`ManageSheet`) asks the same way, so the owner's way out and the
 * member's are one pattern — which is what retired `ui/DangerConfirmButton`, the old
 * arm-and-tap-again button, and its "Emin misin? Sil" label with it.
 */
export const LeaveGroupButton = ({ groupId, kind }: LeaveGroupButtonProps) => {
	const { t } = useTranslation();
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();
	const leaveGroup = useLeaveGroup();

	const confirmLeave = () => {
		/*
		 * **Leave, then go — in that order, and without waiting for the response.**
		 *
		 * The card is already gone from Gruplarım by the time this line runs (the mutation
		 * removes it optimistically), so there is nothing left on this screen worth standing
		 * around for. Hanging the navigation off `onSuccess` is what made leaving take five
		 * seconds and end on an error page; see `useLeaveGroup` for why.
		 *
		 * The failure alert moves into the hook for the same reason. React Query drops
		 * `mutate`'s own callbacks when the component that called it unmounts, and navigating
		 * away unmounts this button — so an `onError` passed here would be the one thing
		 * guaranteed not to run on the one path that needs it.
		 *
		 * Straight to Gruplarım, by name. A group screen is pushed *inside* a tab, so the two
		 * obvious calls both leave you looking at the group you just left:
		 * `navigate('Tabs', { screen: 'Groups' })` selects a tab that is usually already
		 * selected, and `popToTop()` reaches whichever navigator happens to be nearest. Naming
		 * the route is what actually moves — 'Groups' is the root of the Gruplarım stack, and
		 * navigating to a route already below you in a stack pops everything above it rather
		 * than pushing a second copy. From the Home or Keşfet stack there is no such route to
		 * pop to, so the request rises to the tab navigator, which switches tabs — and
		 * `popToTopOnBlur` resets the stack being left behind. One call covers all three ways in.
		 */
		leaveGroup.mutate(groupId);
		navigation.navigate('Groups');
	};

	const handlePress = () => {
		confirmDestructive({
			cancelLabel: t('cancel'),
			confirmLabel: t('leaveGroup'),
			message: t(kind === 'HATIM' ? 'leaveHintCuz' : 'leaveHint'),
			onConfirm: confirmLeave,
			title: t('leaveGroup')
		});
	};

	return (
		/*
		 * `AppButton`, so this takes the platform's own glass where there is one — filled red
		 * either way. `dangerFilled` exists for exactly this: `danger` is the *outlined*
		 * destructive button, and using it here would have swapped a solid button for a hairline
		 * one on every device without glass.
		 *
		 * The glyph crosses too. `leave` has a custom SF Symbol built from the design's own
		 * drawing (`ayril-leave`), so this is our arrow rather than Apple's nearest match — and
		 * without it `AppButton` would have kept the whole button on the drawn path.
		 */
		<AppButton
			disabled={leaveGroup.isPending}
			icon='leave'
			onPress={handlePress}
			title={t('leaveGroup')}
			variant='dangerFilled'
		/>
	);
};
