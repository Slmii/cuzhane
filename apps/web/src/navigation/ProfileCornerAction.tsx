import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import { useUser } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image, Pressable, StyleSheet } from 'react-native';

type TabNavigationProp = NativeStackNavigationProp<TabStackParamList>;

interface ProfileCornerActionProps {
	/**
	 * Ana sayfa's bar floats over the coloured layer. Only the `person` glyph is affected — a
	 * photograph is a photograph on any ground.
	 */
	isOnHeaderSurface?: boolean;
}

/** The photo's diameter — the size a bar item's glyph takes, so it sits in the capsule like one. */
const PHOTO_SIZE = 28;
/** Fetched at 3× so it is sharp on every density without being the original upload. */
const PHOTO_PIXELS = PHOTO_SIZE * 3;
/** `GlassCornerAction`'s target, so the item takes the same slot whichever way it renders. */
const TARGET_SIZE = 44;

/**
 * The URL carries a size. Clerk serves the original upload otherwise, which for a phone photo
 * is a couple of megabytes fetched to fill twenty-eight points.
 */
const sizedProfileUrl = (imageUrl: string) =>
	`${imageUrl}${imageUrl.includes('?') ? '&' : '?'}width=${PHOTO_PIXELS}&height=${PHOTO_PIXELS}&fit=crop`;

/**
 * The way to the account screen, at the right end of every tab root's bar. Profil lost its tab
 * to search in K2, and an account is reached from the top of the screen everywhere else on the
 * platform — as the reader's own face when they have uploaded one, the `person` glyph when not.
 *
 * `hasImage` rather than `imageUrl`: Clerk always answers with a URL, generating a letter
 * avatar when there is no upload. That placeholder is a worse version of what `ui/Avatar`
 * already draws, and it is not what "has a photo" means here.
 *
 * `Profile` is registered in every tab's stack (`sharedTabScreens`), so the push happens
 * inside whichever tab you are on and back returns you there — not to Ana sayfa.
 */
export const ProfileCornerAction = ({ isOnHeaderSurface = false }: ProfileCornerActionProps) => {
	const navigation = useNavigation<TabNavigationProp>();
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { user } = useUser();
	const photoUrl = user?.hasImage ? sizedProfileUrl(user.imageUrl) : null;
	const openProfile = () => navigation.navigate('Profile');

	if (photoUrl === null) {
		return (
			<GlassCornerAction
				accessibilityLabel={t('profile')}
				icon='tabProfile'
				isOnHeaderSurface={isOnHeaderSurface}
				onPress={openProfile}
				systemIcon='person.crop.circle'
				tone='surface'
			/>
		);
	}

	return (
		// A plain image, deliberately: a photograph needs no SF Symbol path, and React Native's own
		// view sits inside the capsule iOS draws around the bar's items just as the hosts do.
		<Pressable
			accessibilityLabel={t('profile')}
			accessibilityRole='button'
			onPress={openProfile}
			style={({ pressed }) => [styles.target, { opacity: pressed ? 0.6 : 1 }]}
		>
			<Image
				source={{ uri: photoUrl }}
				style={[styles.photo, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
			/>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	photo: {
		borderRadius: PHOTO_SIZE / 2,
		borderWidth: StyleSheet.hairlineWidth,
		height: PHOTO_SIZE,
		width: PHOTO_SIZE
	},
	target: {
		alignItems: 'center',
		height: TARGET_SIZE,
		justifyContent: 'center',
		width: TARGET_SIZE
	}
});
