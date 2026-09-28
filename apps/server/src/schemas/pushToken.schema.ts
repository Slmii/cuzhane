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

/** Withdrawing takes any token, so one stored before the Expo check can still be removed. */
export const RemovePushTokenBodySchema = z.object({
	token: z.string().trim().min(1).max(512)
});

export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenBodySchema>;
export type RemovePushTokenBody = z.infer<typeof RemovePushTokenBodySchema>;
