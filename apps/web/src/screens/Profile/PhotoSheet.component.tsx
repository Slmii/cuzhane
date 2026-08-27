import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { BodyStrongText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet } from 'react-native';

type Props = {
	hasPhoto: boolean;
	isVisible: boolean;
	onClose: () => void;
	onPicked: (uri: string) => void;
	onRemoved: () => void;
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
	mediaTypes: ['images'],
	allowsEditing: true,
	aspect: [1, 1],
	quality: 0.8
};

export const PhotoSheet = ({ hasPhoto, isVisible, onClose, onPicked, onRemoved }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const handleTakePhoto = async () => {
		const permission = await ImagePicker.requestCameraPermissionsAsync();

		if (permission.granted) {
			const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);

			if (!result.canceled && result.assets[0]) {
				onPicked(result.assets[0].uri);
			}
		}

		onClose();
	};

	const handlePickFromGallery = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (permission.granted) {
			const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

			if (!result.canceled && result.assets[0]) {
				onPicked(result.assets[0].uri);
			}
		}

		onClose();
	};

	const handleRemovePhoto = () => {
		onRemoved();
		onClose();
	};

	return (
		<AppBottomSheet description={t('photoHint')} isVisible={isVisible} onClose={onClose} title={t('photoTitle')}>
			<Pressable
				onPress={handleTakePhoto}
				style={({ pressed }) => [
					styles.option,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.borderStrong,
						transform: [{ scale: pressed ? 0.96 : 1 }]
					}
				]}
			>
				<BodyStrongText>{t('takePhoto')}</BodyStrongText>
			</Pressable>
			<Pressable
				onPress={handlePickFromGallery}
				style={({ pressed }) => [
					styles.option,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.borderStrong,
						transform: [{ scale: pressed ? 0.96 : 1 }]
					}
				]}
			>
				<BodyStrongText>{t('fromGallery')}</BodyStrongText>
			</Pressable>
			{hasPhoto ? (
				<Pressable
					onPress={handleRemovePhoto}
					style={({ pressed }) => [
						styles.option,
						{
							backgroundColor: theme.colors.surface,
							borderColor: toAlphaColor(theme.colors.danger, 0.28),
							transform: [{ scale: pressed ? 0.96 : 1 }]
						}
					]}
				>
					<BodyStrongText color={theme.colors.danger}>{t('removePhoto')}</BodyStrongText>
				</Pressable>
			) : null}
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	option: {
		borderRadius: 14,
		borderWidth: 1,
		marginBottom: 9,
		padding: 15
	}
});
