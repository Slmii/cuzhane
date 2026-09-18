import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { TrailingCornerAction } from '@/navigation/TrailingCornerAction';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

/**
 * The inbox's bar: the gear to P4, then whatever every other bar ends with.
 *
 * **The gear is how the reminder settings are reached now that they are not a tab.** That is one
 * tap deeper than before, which is the real cost of giving the bell tab to the inbox — Profil's
 * "Bildirimler" row is the second way in, so the daily reminder is never only behind this glyph.
 */
export const NotificationSettingsToolbar = () => {
	const navigation = useNavigation<NativeStackNavigationProp<TabStackParamList>>();
	const { t } = useTranslation();

	return (
		<View style={styles.row}>
			<GlassCornerAction
				accessibilityLabel={t('notifSettingsAction')}
				assetName='ayarlar-settings'
				icon='settings'
				onPress={() => navigation.navigate('Reminders')}
				systemIcon='gearshape'
				tone='surface'
			/>
			<TrailingCornerAction />
		</View>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	}
});
