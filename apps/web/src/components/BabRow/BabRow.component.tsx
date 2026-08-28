import { BodyStrongText, Typography } from '@/components/ui/Typography/Typography.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, ZoomIn } from 'react-native-reanimated';
import type { BabRowProps } from './BabRow.types';

const CHECK_DURATION_MS = 300;

export const BabRow = ({ isRead, onOpen, onToggle, openLabel, style, subtitle, title }: BabRowProps) => {
	const { theme } = useThemeContext();

	// The fill eases in behind the tick instead of flipping instantly.
	const checkboxStyle = useAnimatedStyle(() => ({
		backgroundColor: withTiming(isRead ? theme.colors.accent : theme.colors.surface, {
			duration: CHECK_DURATION_MS
		}),
		borderColor: withTiming(isRead ? theme.colors.accent : theme.colors.borderStrong, {
			duration: CHECK_DURATION_MS
		})
	}));

	return (
		<View style={[styles.row, { borderBottomColor: theme.colors.divider }, style]}>
			{/*
			 * The whole row marks the bab, not just the 26pt box. Everything up to "Oku" is one
			 * target — the padding included, which is why it carries the row's insets rather
			 * than the row doing it — because a list you tick your way down shouldn't ask for a
			 * thumb on a checkbox each time.
			 *
			 * Children as a function so only the box still squeezes on press. Scaling the whole
			 * row would shrink a line of text mid-sentence; dimming it is enough to say the tap
			 * landed, and the tick is the thing being acted on.
			 */}
			<Pressable
				accessibilityRole='checkbox'
				accessibilityState={{ checked: isRead }}
				onPress={onToggle}
				style={({ pressed }) => [styles.toggleArea, { opacity: pressed ? 0.7 : 1 }]}
			>
				{({ pressed }) => (
					<>
						<Animated.View
							style={[styles.checkbox, checkboxStyle, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
						>
							{isRead ? (
								<Animated.View entering={ZoomIn.duration(220)}>
									<Icon color={theme.colors.onAccent} name='check' size={13} strokeWidth={2.2} />
								</Animated.View>
							) : null}
						</Animated.View>

						<View style={styles.copy}>
							<BodyStrongText color={isRead ? theme.colors.faintText : theme.colors.text}>
								{title}
							</BodyStrongText>
							<Typography color={theme.colors.faintText} style={styles.subtitle} variant='caption'>
								{subtitle}
							</Typography>
						</View>
					</>
				)}
			</Pressable>

			<Pressable
				accessibilityRole='button'
				onPress={onOpen}
				style={({ pressed }) => [
					styles.openButton,
					// `surfaceMuted` is the card's own colour in dark mode, which left this
					// button with no visible bounds there. `segmentTrack` is the token that
					// steps off a card in both themes — the same one Home's "Oku" uses, so the
					// two read as one control.
					{ backgroundColor: theme.colors.segmentTrack, opacity: pressed ? 0.7 : 1 }
				]}
			>
				<Typography style={styles.openLabel} variant='stat' weight='semibold'>
					{openLabel}
				</Typography>
			</Pressable>
		</View>
	);
};

const styles = StyleSheet.create({
	checkbox: {
		alignItems: 'center',
		borderRadius: 9,
		borderWidth: 1.5,
		height: 26,
		justifyContent: 'center',
		width: 26
	},
	copy: {
		flex: 1,
		gap: 2
	},
	openButton: {
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 7
	},
	openLabel: {
		fontSize: 10.5,
		letterSpacing: 0,
		textTransform: 'none'
	},
	row: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 13,
		// Only the right inset lives here now. The rest moved onto the tappable half, so the
		// padding is part of the target rather than a dead margin around it.
		paddingRight: 16
	},
	toggleArea: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 13,
		paddingLeft: 16,
		paddingVertical: 13
	},
	subtitle: {
		fontSize: 11
	}
});
