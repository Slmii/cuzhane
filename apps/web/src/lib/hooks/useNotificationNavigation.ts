import type { RootStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLastNotificationResponse } from 'expo-notifications';
import { useEffect, useRef } from 'react';

/**
 * Opening the app from the reminder lands on Ana sayfa.
 *
 * The reminder counts every group, so there is no single bab to open — the home ring is
 * the screen that answers the question it asked ("how much is left today?"), and it is
 * also where each group's own "Oku" sits, one tap from the right bab.
 *
 * `useLastNotificationResponse` rather than a response listener: when the tap *launches*
 * the app, a listener registered on mount can miss the event that started it. This returns
 * the launching response too, so a cold start and a warm one behave the same.
 */
export const useNotificationNavigation = () => {
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
	const response = useLastNotificationResponse();
	/** The response already acted on — the hook keeps returning the same one. */
	const handledIdentifier = useRef<string | null>(null);

	useEffect(() => {
		const identifier = response?.notification.request.identifier;

		if (!identifier || handledIdentifier.current === identifier) {
			return;
		}

		handledIdentifier.current = identifier;

		/*
		 * A server-sent notification says where it came from; the local reminder does not.
		 * Anything carrying a `groupId` is about one group, so it opens that group — landing
		 * on Ana sayfa after being told a specific block changed hands would make the reader
		 * hunt for what they were just told about.
		 */
		const data = response?.notification.request.content.data;
		const groupId = typeof data?.groupId === 'string' ? data.groupId : null;

		if (groupId) {
			navigation.navigate('Tabs', { screen: 'Groups', params: { screen: 'GroupDetail', params: { groupId } } });

			return;
		}

		navigation.navigate('Tabs', { screen: 'Home' });
	}, [navigation, response]);
};
