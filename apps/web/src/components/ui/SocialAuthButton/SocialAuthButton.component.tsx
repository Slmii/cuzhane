import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { SocialAuthButtonProps } from './SocialAuthButton.types';

/**
 * Google's official "G" mark. The design draws a four-quadrant conic gradient, which is a
 * reasonable shorthand in a static mock but on screen reads as the Microsoft logo — four
 * coloured squares in a circle is that brand, not this one. The real mark is also what
 * Google's identity guidelines require on a sign-in button.
 *
 * The four paths are the standard 48-grid artwork, so it renders identically on light and
 * dark: the colours are the brand's own and never inherit from the theme.
 */
const GoogleMark = ({ size = 16 }: { size?: number }) => (
	<Svg height={size} viewBox='0 0 48 48' width={size}>
		<Path
			d='M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z'
			fill='#4285F4'
		/>
		<Path
			d='M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z'
			fill='#34A853'
		/>
		<Path
			d='M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z'
			fill='#FBBC05'
		/>
		<Path
			d='M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z'
			fill='#EA4335'
		/>
	</Svg>
);

export const SocialAuthButton = ({
	isCompact = false,
	isLoading = false,
	label,
	onPress,
	provider,
	style
}: SocialAuthButtonProps) => {
	const { theme } = useThemeContext();
	const isApple = provider === 'apple';

	const backgroundColor = isApple ? theme.colors.primary : theme.colors.surface;
	const textColor = isApple ? theme.colors.onPrimary : theme.colors.text;

	return (
		<Pressable
			accessibilityRole='button'
			disabled={isLoading}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				isCompact ? styles.compact : styles.full,
				{
					backgroundColor,
					borderColor: isApple ? theme.colors.primary : theme.colors.border,
					opacity: isLoading ? 0.6 : 1,
					transform: [{ scale: pressed ? 0.96 : 1 }]
				},
				style
			]}
		>
			{/* No spinner: `isLoading` already dims this to 0.6 and blocks the press, and that
			    dimming is the app's one way of showing a control is busy. See `AppButton`. */}
			<>
				{isApple ? (
					// U+F8FF is Apple's logo glyph — private-use, so it only renders on
					// Apple platforms. That's fine: this button is iOS-only by design.
					<Typography color={textColor} style={styles.appleGlyph}>
						{'\uF8FF'}
					</Typography>
				) : (
					<View style={styles.googleMark}>
						<GoogleMark size={isCompact ? 15 : 16} />
					</View>
				)}
				<Typography color={textColor} style={isCompact ? styles.compactLabel : styles.label}>
					{label}
				</Typography>
			</>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	appleGlyph: {
		fontSize: 15,
		lineHeight: 18
	},
	button: {
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'center'
	},
	compact: {
		borderRadius: 13,
		flex: 1,
		gap: 7,
		padding: 13
	},
	compactLabel: {
		fontSize: 12,
		fontWeight: '600',
		lineHeight: 16
	},
	full: {
		borderRadius: 14,
		gap: 10,
		padding: 14,
		width: '100%'
	},
	googleMark: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	label: {
		fontSize: 13,
		fontWeight: '600',
		lineHeight: 18
	}
});
