import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { APP_LANGUAGES, LANGUAGE_NATIVE_NAMES, type AppLanguage, type StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LanguageSheetProps } from './LanguageSheet.types';

/** Each language's name in the *current* interface language — the second line of its row. */
const LANGUAGE_NAME_KEYS: Record<AppLanguage, StringKey> = {
	en: 'langNameEn',
	nl: 'langNameNl',
	tr: 'langNameTr'
};

const RING_SIZE = 20;
const RING_CHECK_SIZE = 11;

/**
 * G4 — the language list, as a sheet over Profil.
 *
 * It replaced a three-way segmented control, and the reason is in the frame's own title: "a
 * list that scales past two languages". A segment per language was already stacking onto its
 * own line at three, and a fourth would have had nowhere to go. A list has rows.
 *
 * **A tap is the whole transaction.** The row applies the language and closes the sheet — there
 * is no confirm step, because the choice is one tap to reverse and the interface changing under
 * you *is* the confirmation. It briefly carried create-group's × / ✓ pair with the choice held
 * pending until the tick; that was two taps for a decision that needs one, and it went.
 *
 * Every row says the language twice: **in itself** on the first line, so someone who cannot
 * read the current interface can still find their own, and in the interface's language on the
 * second.
 */
export const LanguageSheet = ({ isVisible, onClose }: LanguageSheetProps) => {
	const { theme } = useThemeContext();
	const { language, setLanguage, t } = useTranslation();
	const updateSettings = useUpdateUserSettings();

	const pick = (code: AppLanguage) => {
		if (code !== language) {
			setLanguage(code);
			updateSettings.mutate({ language: code });
		}

		onClose();
	};

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose} title={t('language')}>
			<CardSurface isFlush>
				{APP_LANGUAGES.map((code, index) => {
					const isSelected = code === language;

					return (
						<View key={code}>
							{index > 0 ? <Divider /> : null}
							<Pressable
								accessibilityRole='radio'
								accessibilityState={{ selected: isSelected }}
								onPress={() => pick(code)}
								style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
							>
								<View style={styles.names}>
									<BodyStrongText numberOfLines={1}>{LANGUAGE_NATIVE_NAMES[code]}</BodyStrongText>
									<CaptionText color={theme.colors.subtext} numberOfLines={1}>
										{t(LANGUAGE_NAME_KEYS[code])}
									</CaptionText>
								</View>
								{/* A ring, not a checkbox: exactly one of these is ever on. It fills
								    with the accent and takes the tick together, so the two states are
								    the same shape at two weights rather than an empty circle and a
								    different glyph. */}
								<View
									style={[
										styles.ring,
										{
											backgroundColor: isSelected
												? theme.colors.accent
												: theme.colors.transparent,
											borderColor: isSelected ? theme.colors.accent : theme.colors.borderStrong
										}
									]}
								>
									<Icon
										color={isSelected ? theme.colors.onAccent : theme.colors.transparent}
										name='check'
										size={RING_CHECK_SIZE}
										strokeWidth={3}
									/>
								</View>
							</Pressable>
						</View>
					);
				})}
			</CardSurface>
			<CaptionText color={theme.colors.faintText} style={styles.note}>
				{t('langNote')}
			</CaptionText>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	names: {
		flex: 1,
		gap: 2
	},
	note: {
		lineHeight: 17,
		marginTop: 12
	},
	ring: {
		alignItems: 'center',
		borderRadius: RING_SIZE / 2,
		borderWidth: 1.5,
		height: RING_SIZE,
		justifyContent: 'center',
		width: RING_SIZE
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		minHeight: 52,
		paddingHorizontal: 15,
		paddingVertical: 8
	}
});
