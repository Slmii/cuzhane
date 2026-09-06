import { navigationRef } from '@/navigation/navigationRef';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Replays the tour on demand.
 *
 * `__DEV__` only — the tour is a first-run thing, and a floating button over every screen is
 * a debugging affordance, not a feature. It pushes the route rather than clearing
 * `hasSeenOnboarding`, so replaying it doesn't rewrite what the account has actually seen;
 * the screen's own finish handler notices there is something to go back to and returns
 * there instead of replacing the stack.
 */
export const OnboardingDevTrigger = () => {
	// Inverted once, which is the worst way for this to be wrong: the button vanished in
	// development — where it is the entire point — and appeared over every screen of the
	// release build, where it is a debug control shipped to users. Found on a preview build,
	// one step before the App Store.
	if (!__DEV__) {
		return null;
	}

	return (
		<View pointerEvents='box-none' style={[StyleSheet.absoluteFill, styles.overlay]}>
			<View style={styles.anchor}>
				<Pressable
					onPress={() => {
						if (navigationRef.isReady()) {
							navigationRef.navigate('Onboarding');
						}
					}}
					style={styles.button}
				>
					<Text style={styles.label}>👋 Onboarding</Text>
				</Pressable>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	anchor: {
		bottom: 130,
		left: 16,
		position: 'absolute'
	},
	button: {
		backgroundColor: '#111',
		borderRadius: 999,
		elevation: 5,
		paddingHorizontal: 14,
		paddingVertical: 10,
		shadowColor: '#000',
		shadowOpacity: 0.25,
		shadowRadius: 6
	},
	label: {
		color: 'white',
		fontSize: 12
	},
	overlay: {
		zIndex: 9999
	}
});
