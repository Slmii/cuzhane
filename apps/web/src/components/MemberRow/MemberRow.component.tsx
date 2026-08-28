import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { BodyStrongText, Typography } from '@/components/ui/Typography/Typography.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
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

			{onRemove ? (
				<Pressable accessibilityRole='button' onPress={onRemove} style={styles.remove}>
					<Icon color={theme.colors.faintText} name='close' size={13} strokeWidth={1.9} />
				</Pressable>
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
	remove: {
		paddingHorizontal: 2,
		paddingVertical: 4
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
