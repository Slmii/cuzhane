import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { MUSHAF_DUA_PATHS } from '@/lib/content/mushaf';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { MushafImagePage } from '@/screens/Reader/MushafImagePage.component';
import { StyleSheet, View } from 'react-native';

export const HatimDuaScreen = () => {
	const { t } = useTranslation();

	return (
		<ScreenContainer isScrollable>
			<ScreenHeader hasBackButton subtitle={t('qHatimDuaSub')} title={t('qHatimDua')} />
			<View style={styles.pages}>
				{MUSHAF_DUA_PATHS.map((path, index) => (
					<MushafImagePage
						accessibilityLabel={t('qHatimDuaPage', { a: index + 1, b: MUSHAF_DUA_PATHS.length })}
						key={path}
						nextPath={MUSHAF_DUA_PATHS[index + 1]}
						path={path}
					/>
				))}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	pages: {
		gap: 14
	}
});
