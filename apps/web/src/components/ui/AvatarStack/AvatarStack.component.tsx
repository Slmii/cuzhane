import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import type { AvatarTone } from '@/components/ui/Avatar/Avatar.types';
import { StatText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { AvatarStackProps } from './AvatarStack.types';

const TONE_CYCLE: AvatarTone[] = ['accent', 'sand', 'neutral'];

export const AvatarStack = ({ max = 3, names, size = 22, style }: AvatarStackProps) => {
	const { theme } = useThemeContext();
	const visibleNames = names.slice(0, max);
	const overflowCount = names.length - max;

	return (
		<View style={[styles.row, style]}>
			{visibleNames.map((name, index) => (
				<Avatar
					key={`${name}-${index}`}
					name={name}
					size={size}
					style={[
						styles.ring,
						{ borderColor: theme.colors.surface },
						index > 0 ? { marginLeft: -(size / 3) } : null
					]}
					tone={TONE_CYCLE[index % TONE_CYCLE.length]}
				/>
			))}
			{overflowCount > 0 ? (
				<View
					style={[
						styles.ring,
						styles.circle,
						{
							backgroundColor: theme.colors.surfaceMuted,
							borderColor: theme.colors.surface,
							borderRadius: size / 2,
							height: size,
							marginLeft: -(size / 3),
							width: size
						}
					]}
				>
					<StatText color={theme.colors.subtext}>{`+${overflowCount}`}</StatText>
				</View>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	circle: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	ring: {
		borderWidth: 1.5
	},
	row: {
		flexDirection: 'row'
	}
});
