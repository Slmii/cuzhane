import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { RootTabParamList } from '@/navigation/types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_ICON_SIZE = 21;
/** The design says activity is weight, not fill: 1.6 resting, 2.1 on the active tab. */
const TAB_STROKE_RESTING = 1.6;
const TAB_STROKE_ACTIVE = 2.1;

const BAR_PADDING_TOP = 11;
const BAR_ITEM_GAP = 6;
const BAR_MIN_BOTTOM_INSET = 12;

const TAB_META: Record<keyof RootTabParamList, { labelKey: StringKey; icon: IconName }> = {
	Home: { labelKey: 'home', icon: 'tabHome' },
	Groups: { labelKey: 'groups', icon: 'tabGroups' },
	Discover: { labelKey: 'discover', icon: 'tabDiscover' },
	Notifications: { labelKey: 'notifTabLabel', icon: 'tabReminders' },
	Search: { labelKey: 'search', icon: 'search' },
	Profile: { labelKey: 'profile', icon: 'tabProfile' }
};

type Props = BottomTabBarProps & {
	/**
	 * Screens that want the bar gone — the reader — collapse it to nothing rather than
	 * unmounting it. Same result on screen, but the scene below stays in the tree, so the
	 * outgoing screen doesn't reflow halfway through a push animation.
	 */
	isCollapsed?: boolean;
};

export const BottomNavBar = ({ isCollapsed = false, navigation, state }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();

	if (isCollapsed) {
		return <View style={styles.collapsed} />;
	}

	return (
		<View
			style={[
				styles.bar,
				{
					backgroundColor: theme.colors.surface,
					borderTopColor: theme.colors.border,
					paddingBottom: Math.max(insets.bottom, BAR_MIN_BOTTOM_INSET)
				}
			]}
		>
			{state.routes.map((route, index) => {
				const meta = TAB_META[route.name as keyof RootTabParamList];

				if (!meta) {
					return null;
				}

				const isFocused = state.index === index;
				const color = isFocused ? theme.colors.text : theme.colors.faintText;
				const label = t(meta.labelKey);

				const handlePress = () => {
					const event = navigation.emit({
						type: 'tabPress',
						target: route.key,
						canPreventDefault: true
					});

					if (!isFocused && !event.defaultPrevented) {
						navigation.navigate(route.name);
					}
				};

				return (
					<Pressable
						accessibilityLabel={label}
						accessibilityRole='tab'
						accessibilityState={{ selected: isFocused }}
						key={route.key}
						onPress={handlePress}
						style={styles.item}
					>
						<Icon
							color={color}
							name={meta.icon}
							size={TAB_ICON_SIZE}
							strokeWidth={isFocused ? TAB_STROKE_ACTIVE : TAB_STROKE_RESTING}
						/>
						<Typography color={color} style={styles.label} variant='stat' weight='medium'>
							{label}
						</Typography>
					</Pressable>
				);
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		paddingTop: BAR_PADDING_TOP
	},
	collapsed: {
		height: 0
	},
	item: {
		alignItems: 'center',
		flex: 1,
		gap: BAR_ITEM_GAP
	},
	label: {
		fontSize: 10,
		letterSpacing: 0,
		textTransform: 'none'
	},
	square: {
		borderRadius: 5
	}
});
