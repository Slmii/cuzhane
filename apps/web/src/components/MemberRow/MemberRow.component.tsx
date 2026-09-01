import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { BodyStrongText, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { MemberRowProps } from './MemberRow.types';

export const MemberRow = ({
	imageUrl,
	cheerLabel,
	isCheered = false,
	name,
	onCheer,
	onRemove,
	percent,
	rangeLabel,
	removeLabel,
	style,
	tag
}: MemberRowProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.row, { borderBottomColor: theme.colors.divider }, style]}>
			<Avatar imageUrl={imageUrl} name={name} size={34} tone='sand' />

			<View style={styles.copy}>
				<View style={styles.nameRow}>
					<BodyStrongText>{name}</BodyStrongText>
					{tag ? (
						<View style={[styles.tag, { backgroundColor: theme.colors.surfaceMuted }]}>
							<Typography color={theme.colors.faintText} style={styles.tagLabel} variant='stat'>
								{tag}
							</Typography>
						</View>
					) : null}
				</View>
				<View style={styles.progressRow}>
					<Typography color={theme.colors.faintText} style={styles.range} variant='caption'>
						{rangeLabel}
					</Typography>
					<ProgressBar height={4} percent={percent} style={styles.progressBar} />
				</View>
			</View>

			{onCheer ? (
				<Pressable
					accessibilityRole='button'
					onPress={onCheer}
					style={({ pressed }) => [
						styles.cheer,
						{
							backgroundColor: isCheered ? theme.colors.accentSoft : theme.colors.surface,
							borderColor: isCheered ? theme.colors.accent : theme.colors.border,
							opacity: pressed ? 0.7 : 1
						}
					]}
				>
					<Typography
						color={isCheered ? theme.colors.accent : theme.colors.subtext}
						style={styles.cheerLabel}
						variant='stat'
						weight='semibold'
					>
						{cheerLabel}
					</Typography>
				</Pressable>
			) : null}

			{/*
			 * An `AppButton`, not a bare glyph in a `Pressable`. `close` has a `GLYPH_BY_ICON`
			 * entry, so this takes the glass path where the OS has it and the drawn one everywhere
			 * else — the same crossing every other control in the app makes, which a hand-rolled
			 * `Pressable` was quietly opting out of. Being label-less it comes out a circle on both
			 * paths, which also gives it a real touch target: a 13px glyph with 2px of padding was
			 * about a third of the 44pt minimum, on the one control here that destroys something.
			 *
			 * **`surface`, not `ghost`.** Both cross to `buttonStyle('glass')`, so on iOS 26 they
			 * are the same button — but `ghost` *draws* with no fill, which off the glass path
			 * leaves a bare glyph floating at the end of the row where every other icon button in
			 * the app is a disc. `surface` is what create-group's header close uses, and these two
			 * should not disagree.
			 */}
			{onRemove ? (
				<AppButton
					accessibilityLabel={removeLabel}
					fullWidth={false}
					icon='close'
					onPress={onRemove}
					size='sm'
					variant='surface'
				/>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	cheer: {
		borderRadius: 9,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 8,
		paddingVertical: 6
	},
	cheerLabel: {
		fontSize: 10.5,
		letterSpacing: 0,
		textTransform: 'none'
	},
	copy: {
		flex: 1,
		gap: 6
	},
	nameRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	progressBar: {
		flex: 1
	},
	progressRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 7
	},
	range: {
		fontSize: 10.5
	},
	removeGlyph: {
		fontSize: 15,
		lineHeight: 18
	},
	row: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 11,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	tag: {
		borderRadius: 5,
		paddingHorizontal: 5,
		paddingVertical: 3
	},
	tagLabel: {
		fontSize: 9,
		letterSpacing: 0.55
	}
});
