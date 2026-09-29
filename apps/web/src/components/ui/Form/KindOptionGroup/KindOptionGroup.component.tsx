import { KindMark } from '@/components/ui/KindMark/KindMark.component';
import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { CaptionText, MonoText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupKind } from '@/lib/types/domain';
import { partCountFor } from '@/lib/utils/groupKinds';
import { partUnitKey } from '@/lib/utils/groups';
import { Controller, useFormContext } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import type { FormKindOptionGroupProps } from './KindOptionGroup.types';

/** The mark at the head of a kind's row. */
const MARK_SIZE = 40;

/**
 * The kinds a group can be created as, in the order the cards sit — HC1's three: the Cevşen,
 * the Kur'an (a hatim of thirty cüz) and the Hizb. The Kur'an card keeps Q1's own name and
 * hint (`qHatim`), the words the rest of the hatim flow uses.
 */
const KIND_CARDS: readonly { kind: GroupKind; title: StringKey; hint: StringKey }[] = [
	{ hint: 'kindCevsenHint', kind: 'CEVSEN', title: 'kindCevsen' },
	{ hint: 'qHatimHint', kind: 'HATIM', title: 'qHatim' },
	{ hint: 'kindHizbHint', kind: 'HIZB', title: 'kindHizb' }
];

type KindCardProps = {
	kind: GroupKind;
	title: string;
	hint: string;
	isSelected: boolean;
	onPress: () => void;
};

/**
 * One kind, as a full-width row: its mark, its name in the heading face over what it is, and at
 * the end how many parts it divides.
 *
 * The same fill, border and press as `OptionCard`, because it is the same control with more in
 * it: `accentSoft` and an accent border when chosen, the flat `surface` and a hairline when not.
 */
const KindCard = ({ hint, isSelected, kind, onPress, title }: KindCardProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const ground = isSelected ? theme.colors.accentSoft : theme.colors.surface;

	return (
		<Pressable
			accessibilityRole='radio'
			accessibilityState={{ selected: isSelected }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: ground,
					borderColor: isSelected
						? theme.colors.accent
						: pressed
						? theme.colors.accentMid
						: theme.colors.border,
					borderRadius: theme.radius.md,
					transform: [{ translateY: pressed ? -2 : 0 }]
				}
			]}
		>
			{/*
			 * The Kur'an's mark is the open mushaf from `ReadingTypeMark` — `KindMark` draws only
			 * the tesbih and the star. Its spine is knocked out of the fill, so it is told the
			 * card's own ground.
			 */}
			{kind === 'HATIM' ? (
				<ReadingTypeMark backgroundColor={ground} kind={kind} size={MARK_SIZE} />
			) : (
				<KindMark kind={kind} size={MARK_SIZE} />
			)}
			<View style={styles.body}>
				<TitleText>{title}</TitleText>
				<CaptionText color={theme.colors.subtext} style={styles.hint}>
					{hint}
				</CaptionText>
			</View>
			<MonoText color={isSelected ? theme.colors.accent : theme.colors.faintText} style={styles.count}>
				{`${partCountFor(kind)} ${t(partUnitKey(kind))}`}
			</MonoText>
		</Pressable>
	);
};

/**
 * The create sheet's first question — which book — as a list of kind cards, bound to a form
 * field the way `FormOptionGroup` binds visibility. A control of its own rather than options
 * handed to that one, because a kind card carries a mark and a count an `OptionCard` has no
 * room for.
 */
export const FormKindOptionGroup = ({ error, name, onChange, style }: FormKindOptionGroupProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={name}
			render={({ field, fieldState }) => {
				const message = fieldState.error?.message || error;

				const select = (kind: GroupKind) => {
					if (kind === field.value) {
						return;
					}

					field.onChange(kind);
					onChange?.(kind);
				};

				return (
					<View style={style}>
						<View style={styles.row}>
							{KIND_CARDS.map(card => (
								<KindCard
									hint={t(card.hint)}
									isSelected={field.value === card.kind}
									key={card.kind}
									kind={card.kind}
									onPress={() => select(card.kind)}
									title={t(card.title)}
								/>
							))}
						</View>
						{message ? (
							<CaptionText color={theme.colors.danger} style={styles.message}>
								{message}
							</CaptionText>
						) : null}
					</View>
				);
			}}
		/>
	);
};

const styles = StyleSheet.create({
	/** Takes the width between the mark and the count, so the hint wraps there. */
	body: {
		flex: 1
	},
	card: {
		alignItems: 'center',
		borderWidth: 1.5,
		flexDirection: 'row',
		gap: 14,
		padding: 14
	},
	count: {
		alignSelf: 'flex-start'
	},
	// `OptionCard`'s hint, so the two kinds of card read as one family across the steps.
	hint: {
		fontSize: 10.5,
		lineHeight: 15,
		marginTop: 4
	},
	message: {
		marginLeft: 14,
		marginTop: 4
	},
	// `FormOptionGroup`'s gap, one kind under the other.
	row: {
		gap: 9
	}
});
