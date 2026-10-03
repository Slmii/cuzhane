import { AppButton } from '@/components/ui/Button/Button.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { hizbPortionLabel } from '@/lib/utils/groups';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
	isVisible: boolean;
	/** The board portions the day covers — every one offered, ticked to begin with. */
	portions: number[];
	/** Those already marked on an earlier visit: they stay ticked; "Geri al" is how they come off. */
	alreadyRead: number[];
	readsFromBook: boolean;
	isPending: boolean;
	onClose: () => void;
	onConfirm: (portions: number[], readsFromBook: boolean) => void;
	/** A Şahsi Kur'an day ticks its cüz ("1. Cüz") rather than the Hizb's portions. */
	unit?: 'portion' | 'cuz';
};

/** R2's boxes: 22 with radius 7 for a portion, 18 with radius 5 for "hep kitaptan". */
const Box = ({ isChecked, isLarge, isMuted = false }: { isChecked: boolean; isLarge: boolean; isMuted?: boolean }) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[
				isLarge ? styles.boxLarge : styles.boxSmall,
				{
					backgroundColor: isChecked ? theme.colors.accent : theme.colors.transparent,
					borderColor: isChecked ? theme.colors.accent : toAlphaColor(theme.colors.text, 0.3),
					borderWidth: isChecked ? 0 : 1.5,
					opacity: isMuted ? 0.55 : 1
				}
			]}
		>
			{isChecked ? (
				<Icon color={theme.colors.onAccent} name='check' size={isLarge ? 14 : 12} strokeWidth={2.4} />
			) : null}
		</View>
	);
};

/**
 * R2 — "Kitaptan okudum": which of the day's portions were read, from the book or anywhere else.
 * All of them come ticked; unticking some marks the rest only, and the day stays owed. The
 * "hep kitaptan" box is the member's own choice for this group, and unticking it here is also
 * how it is turned off again.
 *
 * The header is drawn here rather than by the sheet: R2 sets its title at 20 and its note full
 * width at 12.5, where the shared sheet header is 21 and a narrower 12.
 */
export const HizbBookSheet = ({ isVisible, onClose, ...body }: Props) => (
	<AppBottomSheet isVisible={isVisible} onClose={onClose}>
		{/* Remounted on every opening: all ticked and the saved choice, not the last visit's edits. */}
		<SheetBody key={String(isVisible)} {...body} />
	</AppBottomSheet>
);

const SheetBody = ({
	alreadyRead,
	isPending,
	onConfirm,
	portions,
	readsFromBook,
	unit = 'portion'
}: Omit<Props, 'isVisible' | 'onClose'>) => {
	const { t, language } = useTranslation();
	const { theme } = useThemeContext();
	const [ticked, setTicked] = useState<number[]>(portions);
	const [isAlways, setIsAlways] = useState(readsFromBook);
	const hairline = toAlphaColor(theme.colors.text, 0.08);

	const toggle = (portion: number) =>
		setTicked(current =>
			current.includes(portion) ? current.filter(p => p !== portion) : [...current, portion].sort((a, b) => a - b)
		);

	return (
		<View style={styles.body}>
			<View>
				<TitleText style={styles.title} weight='regular'>
					{t('hbSheetTitle')}
				</TitleText>
				<CaptionText color={toAlphaColor(theme.colors.text, 0.55)} style={styles.hint}>
					{t('hbSheetHint')}
				</CaptionText>
			</View>
			<View style={[styles.list, { backgroundColor: theme.colors.surface, borderColor: hairline }]}>
				{portions.map((portion, index) => {
					const isLocked = alreadyRead.includes(portion);
					const isChecked = isLocked || ticked.includes(portion);

					return (
						<Pressable
							accessibilityRole='checkbox'
							accessibilityState={{ checked: isChecked, disabled: isLocked }}
							disabled={isLocked}
							key={portion}
							onPress={() => toggle(portion)}
							style={[
								styles.row,
								index > 0
									? { borderTopColor: toAlphaColor(theme.colors.text, 0.07), borderTopWidth: 1 }
									: null
							]}
						>
							<Box isChecked={isChecked} isLarge isMuted={isLocked} />
							<CaptionText style={styles.rowLabel} weight='semibold'>
								{unit === 'cuz'
									? t('cuzOrdinal', { n: portion })
									: hizbPortionLabel(String(portion), t)}
							</CaptionText>
						</Pressable>
					);
				})}
			</View>
			<Pressable
				accessibilityRole='checkbox'
				accessibilityState={{ checked: isAlways }}
				hitSlop={6}
				onPress={() => setIsAlways(value => !value)}
				style={styles.always}
			>
				<Box isChecked={isAlways} isLarge={false} />
				<CaptionText color={toAlphaColor(theme.colors.text, 0.72)} style={styles.alwaysLabel} weight='medium'>
					{t('hbAlways')}
				</CaptionText>
			</Pressable>
			<AppButton
				disabled={isPending || ticked.length === 0}
				onPress={() =>
					onConfirm(
						[...new Set([...alreadyRead, ...ticked])].sort((a, b) => a - b),
						isAlways
					)
				}
				title={t(
					unit === 'cuz'
						? pluralKey(language, ticked.length, 'hbConfirmCuzOne', 'hbConfirmCuzOther')
						: pluralKey(language, ticked.length, 'hbConfirmOne', 'hbConfirmOther'),
					{ count: ticked.length }
				)}
				size='lg'
				variant='primary'
			/>
		</View>
	);
};

// R2, by the pixel: 14 between blocks; the list a 1px hairline box of radius 14 with 12×14 rows.
const styles = StyleSheet.create({
	always: { alignItems: 'center', flexDirection: 'row', gap: 10 },
	alwaysLabel: { flex: 1, fontSize: 12.5, lineHeight: 17 },
	body: { gap: 14, paddingBottom: 20 },
	boxLarge: { alignItems: 'center', borderRadius: 7, height: 22, justifyContent: 'center', width: 22 },
	boxSmall: { alignItems: 'center', borderRadius: 5, height: 18, justifyContent: 'center', width: 18 },
	hint: { fontSize: 12.5, lineHeight: 18.75, marginTop: 4 },
	list: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
	row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
	rowLabel: { fontSize: 13, lineHeight: 18 },
	title: { fontSize: 20, lineHeight: 25 }
});
