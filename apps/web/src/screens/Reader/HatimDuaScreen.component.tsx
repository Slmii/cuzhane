import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { MUSHAF_DUA_PATHS } from '@/lib/content/mushaf';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { MushafImagePage } from '@/screens/Reader/MushafImagePage.component';
import { StyleSheet, View } from 'react-native';

/**
 * The Hatim duası — **Hayrat Neşriyat's own pages, in Hüsrev hattı**, which their app sets after
 * the mushaf (`hatimdua.html`, used with the same written permission as the pages). It is the
 * only sourced text of the du'a the app has, so it is shown in this hand whatever face the
 * reader has chosen, and there is no Aa here: nothing is typeset, transliterated or rebuilt.
 *
 * The four pages stack and scroll as one, as that app's own page does, each on the same light
 * paper and through the same cache as a mushaf page. Opened from Q7 and from a hatim group's
 * screen; it belongs to no group, so it takes no params.
 */
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
