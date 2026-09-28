import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type SkeletonGhostProps = {
	/** The real control, drawn invisible, so the bone takes exactly its size and place. */
	children: ReactNode;
	radius: number;
	style?: StyleProp<ViewStyle>;
};

/**
 * A bone the exact size of a real control — a search field, a segmented control — whose height
 * is the platform's (a glass control on iOS 26, a drawn one elsewhere) rather than a number a
 * skeleton could copy. The control is laid out but hidden and inert; a soft bone covers its box.
 */
export const SkeletonGhost = ({ children, radius, style }: SkeletonGhostProps) => {
	const { theme } = useThemeContext();

	return (
		<View accessibilityElementsHidden importantForAccessibility='no-hide-descendants' style={style}>
			<View pointerEvents='none' style={styles.hidden}>
				{children}
			</View>
			<View
				pointerEvents='none'
				style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.divider, borderRadius: radius }]}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	hidden: {
		opacity: 0
	}
});
