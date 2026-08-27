import { ClerkProvider as BaseClerkProvider, ClerkLoaded } from '@clerk/expo';
import { ReactNode } from 'react';
import { tokenCache } from '@clerk/expo/token-cache';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
	throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Add it to your .env file.');
}

type ClerkProviderProps = {
	children: ReactNode;
};

export const ClerkProvider = ({ children }: ClerkProviderProps) => (
	<BaseClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
		<ClerkLoaded>{children}</ClerkLoaded>
	</BaseClerkProvider>
);
