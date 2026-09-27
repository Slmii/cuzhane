import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { CaptionText, Header3, MonoText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupKind } from '@/lib/types/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReadingTypePickerProps } from './ReadingTypePicker.types';

/**
 * Q1's two cards: what the group reads, asked before anything else.
 *
 * **Each card carries its kind's mark**, from the design system's `Okuma Türü Simgeleri`
 * page — a tesbih for the Cevşen, an open mushaf on a rahle for the Kur'an. That is the
 * whole reason this is not an `OptionGroup` of title-and-hint rows like every other choice
 * in this flow: the difference between the two is not a sentence, and a reader who has
 * never met the word "cüz" can still tell a prayer-bead ring from a book.
 *
 * The marks say only which kind it is. They drew progress in an earlier revision, and the
 * cards before that drew miniature boards; both were describing a group that does not exist
 * yet, on the screen where one is being decided.
 */
export const ReadingTypePicker = ({ onChange, value }: ReadingTypePickerProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const renderCard = (kind: GroupKind) => {
		const isSelected = value === kind;

		return (
			<Pressable
				accessibilityLabel={kind === 'HATIM' ? t('qHatim') : t('qCevsen')}
				accessibilityRole='radio'
				accessibilityState={{ selected: isSelected }}
				onPress={() => onChange(kind)}
				style={({ pressed }) => [
					styles.card,
					{
						backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surface,
						borderColor: isSelected ? theme.colors.accent : theme.colors.border,
						opacity: pressed ? 0.85 : 1
					}
				]}
			>
				{/*
				 * **The design system's own mark, not a mock board.** Each card used to draw a
				 * lattice of cells, which said "finer-grained" and nothing else; the marks say
				 * what the thing *is* — a tesbih told bead by bead, an open mushaf under an arc
				 * of thirty. They are drawn part-read here because a mark showing nothing read
				 * reads as an empty group rather than as an illustration.
				 */}
				<View style={styles.mark}>
					<ReadingTypeMark
						// Knocked out of the card's own fill, which changes when it is selected.
						backgroundColor={isSelected ? theme.colors.accentSoft : theme.colors.surface}
						kind={kind}
						size={MARK_SIZE}
					/>
				</View>
				<View>
					<Header3 style={styles.name}>{kind === 'HATIM' ? t('qHatim') : t('qCevsen')}</Header3>
					<CaptionText color={theme.colors.subtext}>
						{kind === 'HATIM' ? t('qHatimHint') : t('qCevsenHint')}
					</CaptionText>
				</View>
				<MonoText color={isSelected ? theme.colors.accent : theme.colors.faintText} style={styles.meta}>
					{kind === 'HATIM' ? t('qHatimMeta') : t('qCevsenMeta')}
				</MonoText>
			</Pressable>
		);
	};

	return (
		<View accessibilityRole='radiogroup' style={styles.row}>
			{renderCard('CEVSEN')}
			{renderCard('HATIM')}
		</View>
	);
};

/** The page's own size for this card ("QC1 tür seçimi" draws it at 56 on a 1fr column). */
const MARK_SIZE = 56;

const styles = StyleSheet.create({
	card: {
		borderRadius: 18,
		borderWidth: 1.5,
		flex: 1,
		gap: 12,
		paddingBottom: 14,
		paddingHorizontal: 15,
		paddingTop: 16
	},
	/** Centred in the card, as the page draws it. */
	mark: {
		alignItems: 'center'
	},
	meta: {
		fontSize: 10
	},
	name: {
		marginBottom: 4
	},
	row: {
		flexDirection: 'row',
		gap: 9
	}
});
