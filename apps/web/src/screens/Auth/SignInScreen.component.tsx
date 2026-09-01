import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { SocialAuthButton } from '@/components/ui/SocialAuthButton/SocialAuthButton.component';
// Google's official four-colour mark, which their sign-in guidelines require. A PNG because it
// is artwork rather than a glyph — see `AppButton`'s `imageIcon`.
const googleMark = require('@/assets/brand/google.png');
import { BodyStrongText, CaptionText, FieldLabelText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createSignInSchema, SignInForm } from '@/lib/schemas/auth.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { describeClerkError } from '@/lib/utils/clerkErrors';
import { AuthStackParamList } from '@/navigation/types';
import { useSignIn } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { AuthDivider } from './AuthDivider.component';

type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export const SignInScreen = ({ navigation }: SignInScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	// Core 3's signal-based hook: `signIn` is the future resource, and every call
	// resolves to `{ error }` rather than throwing.
	const { signIn } = useSignIn();
	const { startSSOFlow } = useSSO();

	const [errorKey, setErrorKey] = useState<'extraVerification' | 'genericError' | null>(null);
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
	const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);

	const isAppleAvailable = Platform.OS === 'ios';

	const schema = useMemo(() => createSignInSchema(t), [t]);

	const handleSignIn = useCallback(
		async (values: SignInForm) => {
			if (!signIn) {
				return;
			}

			setErrorKey(null);
			setIsSigningIn(true);

			try {
				const { error } = await signIn.password({ identifier: values.email, password: values.password });

				if (error) {
					if (__DEV__) {
						console.warn('[signIn] password rejected:', describeClerkError(error));
					}

					setErrorKey('genericError');
					return;
				}

				// The password is only the first factor. An account with MFA or device trust
				// enrolled stops short of 'complete', and finalizing there fails with an error
				// that reads as "wrong password" — so say what is actually happening instead.
				if (signIn.status !== 'complete') {
					if (__DEV__) {
						console.warn('[signIn] attempt not complete:', signIn.status);
					}

					setErrorKey('extraVerification');
					return;
				}

				// `finalize()` promotes the completed attempt to the active session, which is
				// what flips `useAuth()` over to signed-in.
				const { error: finalizeError } = await signIn.finalize();

				if (finalizeError) {
					setErrorKey('genericError');
				}
			} finally {
				setIsSigningIn(false);
			}
		},
		[signIn]
	);

	// The experimental SSO hook is the Core 3 one — it drives the future resources and
	// activates the completed session itself, so there is no finalize step here.
	const handleSSO = useCallback(
		async (strategy: 'oauth_google' | 'oauth_apple', setBusy: (value: boolean) => void) => {
			setErrorKey(null);
			setBusy(true);

			try {
				const { createdSessionId } = await startSSOFlow({ strategy });

				if (!createdSessionId) {
					setErrorKey('genericError');
				}
			} catch {
				setErrorKey('genericError');
			} finally {
				setBusy(false);
			}
		},
		[startSSOFlow]
	);

	return (
		<ScreenContainer contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<BrandMark style={styles.mark} />
				<Header1 style={styles.wordmark} textAlign='center'>
					Cüzhane
				</Header1>
				<CaptionText color={theme.colors.subtext} style={styles.subtitle} textAlign='center'>
					{t('signInSub')}
				</CaptionText>
			</View>
			<View style={styles.social}>
				<SocialAuthButton
					isLoading={isGoogleSigningIn}
					label={t('continueGoogle')}
					imageIcon={googleMark}
					onPress={() => handleSSO('oauth_google', setIsGoogleSigningIn)}
				/>
				{isAppleAvailable ? (
					<SocialAuthButton
						isLoading={isAppleSigningIn}
						label={t('continueApple')}
						variant='primary'
						onPress={() => handleSSO('oauth_apple', setIsAppleSigningIn)}
						systemIcon='apple.logo'
					/>
				) : null}
			</View>
			<AuthDivider style={styles.divider} />
			<Form<SignInForm>
				isFullHeight={false}
				defaultValues={{ email: '', password: '' }}
				isDisabled={isSigningIn}
				schema={schema}
				render={({ handleSubmit }) => (
					<View style={styles.form}>
						<Field
							autoCapitalize='none'
							autoComplete='email'
							autoCorrect={false}
							keyboardType='email-address'
							label={t('email')}
							name='email'
							textContentType='emailAddress'
						/>
						<View>
							<View style={styles.passwordLabelRow}>
								<FieldLabelText color={theme.colors.faintText}>{t('password')}</FieldLabelText>
								<Pressable onPress={() => navigation.push('ForgotPassword')}>
									{/* Sentence case, unlike the field label beside it: it is a link,
									    not a label, and the design sets it apart that way. */}
									<FieldLabelText color={theme.colors.accent} style={styles.forgotLink}>
										{t('forgot')}
									</FieldLabelText>
								</Pressable>
							</View>
							<Field
								autoCapitalize='none'
								autoComplete='current-password'
								autoCorrect={false}
								containerStyle={styles.passwordField}
								name='password'
								onSubmitEditing={handleSubmit(handleSignIn)}
								returnKeyType='go'
								secureTextEntry
								textContentType='password'
							/>
						</View>
						{errorKey ? <CaptionText color={theme.colors.danger}>{t(errorKey)}</CaptionText> : null}
						<AppButton
							isLoading={isSigningIn}
							onPress={handleSubmit(handleSignIn)}
							style={styles.submit}
							title={t('signInTitle')}
						/>
					</View>
				)}
			/>
			<View style={styles.footer}>
				<CaptionText color={theme.colors.subtext}>{`${t('noAccount')} `}</CaptionText>
				<Pressable onPress={() => navigation.push('SignUp')}>
					<BodyStrongText color={theme.colors.accent}>{t('signUp')}</BodyStrongText>
				</Pressable>
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	content: {
		justifyContent: 'center'
	},
	// The design's numbers, read off 01A: 30 under the title block, 20 under the social
	// column, 18 under the rule, 18 above the sign-up line.
	divider: {
		marginBottom: 18
	},
	footer: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: 18
	},
	forgotLink: {
		textTransform: 'none'
	},
	form: {
		gap: 14
	},
	header: {
		marginBottom: 30
	},
	mark: {
		alignSelf: 'center',
		marginBottom: 14
	},
	passwordField: {
		marginTop: 8
	},
	passwordLabelRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	social: {
		gap: 9,
		marginBottom: 20
	},
	// The password field carries 18 below it, not the form's shared 14.
	submit: {
		marginTop: 4
	},
	subtitle: {
		alignSelf: 'center',
		marginTop: 8,
		maxWidth: 250
	},
	wordmark: {
		fontSize: 24,
		lineHeight: 26,
		marginBottom: 16
	}
});
