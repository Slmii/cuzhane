import { Expo } from 'expo-server-sdk';
import { z } from 'zod';

export const RegisterPushTokenBodySchema = z.object({
	// Only a real Expo token is stored: anything else would sit in every fan-out and fail.
	token: z
		.string()
		.trim()
		.min(1)
		.max(512)
		.refine(token => Expo.isExpoPushToken(token), { message: 'Not an Expo push token' })
});

export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenBodySchema>;
