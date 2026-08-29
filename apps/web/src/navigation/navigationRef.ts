import type { RootStackParamList } from '@/navigation/types';
import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * A handle on navigation for the few things that live *beside* the navigator rather than
 * inside it — currently only the onboarding replay trigger, which is a sibling of
 * `AppNavigator` and so has no screen to take `useNavigation` from.
 *
 * Prefer `useNavigation` everywhere a screen can reach it; this exists for the exceptions.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
