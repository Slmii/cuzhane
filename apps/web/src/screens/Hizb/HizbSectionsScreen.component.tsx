import { AppButton } from '@/components/ui/Button/Button.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { HIZB_SECTIONS, sectionPageRange } from '@/lib/content/hizbulhakaik';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbSections'>;

/**
 * The Hizb-ül Hakaik's table of contents: the seventeen sections as rows, each with the pages
 * it spans in the print. A row opens `HizbReader` on that section.
 *
 * Reached from a row on Profil. Rows rather than cards because a table of contents is a list —
 * the shape `LanguageSheet` and Profil's own settings rows already use.
 */
export const HizbSectionsScreen = ({ navigation }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer>
			<ScreenHeader hasBackButton subtitle={t('hizbSub')} title={t('hizbTitle')} />
			<AppButton title={t('hrGroups')} onPress={() => navigation.navigate('HizbGroups')} />
			<CardSurface isFlush>
				{HIZB_SECTIONS.map((section, index) => {
					const { from, to } = sectionPageRange(section);

					return (
						<View key={section.title}>
							{index > 0 ? <Divider /> : null}
							<Pressable
								accessibilityRole='button'
								onPress={() => navigation.navigate('HizbReader', { sectionIndex: index })}
								style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
							>
								<View style={styles.copy}>
									<BodyStrongText numberOfLines={1}>{section.title}</BodyStrongText>
									<CaptionText color={theme.colors.subtext}>
										{from === to ? t('hizbPage', { page: from }) : t('hizbPages', { from, to })}
									</CaptionText>
								</View>
								<Icon color={theme.colors.subtext} name='chevronRight' size={14} strokeWidth={1.8} />
							</Pressable>
						</View>
					);
				})}
			</CardSurface>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	copy: {
		flex: 1,
		gap: 2
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		minHeight: 52,
		paddingHorizontal: 15,
		paddingVertical: 10
	}
});
