import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { SocialAuthButton } from '@/components/ui/SocialAuthButton/SocialAuthButton.component';
import { CaptionText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import {
	createSignUpSchema,
	createVerificationSchema,
	PASSWORD_MIN_LENGTH,
	SignUpForm,
	VerificationForm
} from '@/lib/schemas/auth.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { clerkErrorCodes, describeClerkError, type ClerkErrorLike } from '@/lib/utils/clerkErrors';
import { AuthStackParamList } from '@/navigation/types';
import { useSignUp } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AuthDivider } from './AuthDivider.component';

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

type SignUpErrorKey =
	| 'emailTaken'
	| 'passwordWeak'
	| 'signUpBlocked'
	| 'codeInvalid'
	| 'extraVerification'
	| 'genericError';

/**
 * Clerk's API codes, mapped to something a person can act on. Anything unmapped keeps the
 * generic message and is logged in dev — every specific message here was verified against
 * the API rather than guessed.
 *
 * `captcha_*` is the odd one out. Bot Protection's challenge is a browser widget that
 * native cannot render, so these only appear if the instance's **Native API** setting is
 * off — that pathway is what bypasses the challenge for us. Nothing the person typing can
 * do about it, hence "try again shortly" while the fix is a Dashboard toggle.
 */
const SIGN_UP_ERRORS: Record<string, SignUpErrorKey> = {
	form_identifier_exists: 'emailTaken',
	form_identifier_exists_verified: 'emailTaken',
	form_password_pwned: 'passwordWeak',
	form_password_not_strong_enough: 'passwordWeak',
	form_password_length_too_short: 'passwordWeak',
	captcha_missing_token: 'signUpBlocked',
	captcha_invalid: 'signUpBlocked',
	captcha_not_enabled: 'signUpBlocked',
	form_code_incorrect: 'codeInvalid',
	verification_expired: 'codeInvalid',
	verification_failed: 'codeInvalid'
};

const toErrorKey = (error: ClerkErrorLike, context: string): SignUpErrorKey => {
	const codes = clerkErrorCodes(error);
	const key = codes.map(code => SIGN_UP_ERRORS[code]).find(Boolean);

	if (!key && __DEV__) {
		console.warn(`[signUp] unmapped Clerk error in ${context}:`, describeClerkError(error));
	}

	return key ?? 'genericError';
};

export const SignUpScreen = ({ navigation }: SignUpScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	// Core 3's signal-based hook: `signUp` is the future resource and its calls resolve
	// to `{ error }` instead of throwing.
	const { signUp } = useSignUp();
	const { startSSOFlow } = useSSO();

	const [isPendingVerification, setIsPendingVerification] = useState(false);
	const [errorKey, setErrorKey] = useState<SignUpErrorKey | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
	const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);

	const isAppleAvailable = Platform.OS === 'ios';

	const signUpSchema = useMemo(() => createSignUpSchema(t), [t]);
	const verificationSchema = useMemo(() => createVerificationSchema(t), [t]);

	const handleSignUp = useCallback(
		async (values: SignUpForm) => {
			if (!signUp) {
				return;
			}

			setErrorKey(null);
			setIsSubmitting(true);

			try {
				const { error } = await signUp.password({
					emailAddress: values.email,
					password: values.password,
					firstName: values.firstName,
					lastName: values.lastName
				});

				if (error) {
					setErrorKey(toErrorKey(error, 'password'));
					return;
				}

				const { error: sendError } = await signUp.verifications.sendEmailCode();

				if (sendError) {
					setErrorKey(toErrorKey(sendError, 'sendEmailCode'));
					return;
				}

				setIsPendingVerification(true);
			} finally {
				setIsSubmitting(false);
			}
		},
		[signUp]
	);

	const handleVerify = useCallback(
		async (values: VerificationForm) => {
			if (!signUp) {
				return;
			}

			setErrorKey(null);
			setIsSubmitting(true);

			try {
				const { error } = await signUp.verifications.verifyEmailCode({ code: values.code });

				if (error) {
					setErrorKey(toErrorKey(error, 'verifyEmailCode'));
					return;
				}

				// Verifying the e-mail usually completes the sign-up, but the instance can
				// require another field. Finalizing an incomplete attempt just errors, so
				// check first and log what is still outstanding.
				if (signUp.status !== 'complete') {
					if (__DEV__) {
						console.warn(
							'[signUp] attempt not complete:',
							signUp.status,
							'missing:',
							signUp.missingFields,
							'unverified:',
							signUp.unverifiedFields
						);
					}

					setErrorKey('extraVerification');
					return;
				}

				// `finalize()` turns the completed sign-up into the active session so
				// `useAuth()` reports the user as signed in.
				const { error: finalizeError } = await signUp.finalize();

				if (finalizeError) {
					setErrorKey(toErrorKey(finalizeError, 'finalize'));
				}
			} finally {
				setIsSubmitting(false);
			}
		},
		[signUp]
	);

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

	if (isPendingVerification) {
		return (
			<ScreenContainer>
				<Header1>{t('verifyEmailTitle')}</Header1>
				<CaptionText color={theme.colors.subtext} style={styles.verifyHint}>
					{t('verifyEmailHint')}
				</CaptionText>
				<Form<VerificationForm>
					isFullHeight={false}
					defaultValues={{ code: '' }}
					isDisabled={isSubmitting}
					schema={verificationSchema}
					render={({ handleSubmit }) => (
						<View style={styles.form}>
							<Field
								autoCapitalize='none'
								autoComplete='one-time-code'
								autoCorrect={false}
								autoFocus
								keyboardType='number-pad'
								label={t('verificationCode')}
								maxLength={6}
								name='code'
								onSubmitEditing={handleSubmit(handleVerify)}
								returnKeyType='go'
								textContentType='oneTimeCode'
							/>
							{errorKey ? <CaptionText color={theme.colors.danger}>{t(errorKey)}</CaptionText> : null}
							<AppButton
								isLoading={isSubmitting}
								onPress={handleSubmit(handleVerify)}
								title={t('verify')}
							/>
							<AppButton
								onPress={() => setIsPendingVerification(false)}
								title={t('back')}
								variant='ghost'
							/>
						</View>
					)}
				/>
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer>
			<ScreenHeader onBack={() => navigation.goBack()} subtitle={t('signUpSub')} title={t('signUpTitle')} />
			<View style={styles.social}>
				<SocialAuthButton
					isCompact
					isLoading={isGoogleSigningIn}
					label='Google'
					onPress={() => handleSSO('oauth_google', setIsGoogleSigningIn)}
					provider='google'
				/>
				{isAppleAvailable ? (
					<SocialAuthButton
						isCompact
						isLoading={isAppleSigningIn}
						label='Apple'
						onPress={() => handleSSO('oauth_apple', setIsAppleSigningIn)}
						provider='apple'
					/>
				) : null}
			</View>
			<AuthDivider style={styles.divider} />
			<Form<SignUpForm>
				isFullHeight={false}
				defaultValues={{ firstName: '', lastName: '', email: '', password: '' }}
				isDisabled={isSubmitting}
				schema={signUpSchema}
				render={({ handleSubmit }) => (
					<View style={styles.form}>
						<View style={styles.nameRow}>
							<Field
								autoCapitalize='words'
								autoComplete='given-name'
								autoCorrect={false}
								containerStyle={styles.nameField}
								label={t('firstName')}
								name='firstName'
								textContentType='givenName'
							/>
							<Field
								autoCapitalize='words'
								autoComplete='family-name'
								autoCorrect={false}
								containerStyle={styles.nameField}
								label={t('lastName')}
								name='lastName'
								textContentType='familyName'
							/>
						</View>
						<Field
							autoCapitalize='none'
							autoComplete='email'
							autoCorrect={false}
							keyboardType='email-address'
							label={t('email')}
							name='email'
							textContentType='emailAddress'
						/>
						<Field
							autoCapitalize='none'
							autoComplete='new-password'
							autoCorrect={false}
							helperText={t('passwordHint', { count: PASSWORD_MIN_LENGTH })}
							label={t('password')}
							messageStyle={styles.passwordHint}
							name='password'
							onSubmitEditing={handleSubmit(handleSignUp)}
							returnKeyType='go'
							secureTextEntry
							textContentType='newPassword'
						/>
						{errorKey ? <CaptionText color={theme.colors.danger}>{t(errorKey)}</CaptionText> : null}
						<AppButton
							isLoading={isSubmitting}
							onPress={handleSubmit(handleSignUp)}
							style={styles.submit}
							title={t('createAccount')}
						/>
						<CaptionText color={theme.colors.faintText} style={styles.terms} textAlign='center'>
							{t('terms')}
						</CaptionText>
					</View>
				)}
			/>
			{/* Clerk mounts its CAPTCHA widget here on Expo web; iOS and Android skip it. */}
			<View nativeID='clerk-captcha' />
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// 01B's numbers: 16 under the social row and under the rule, 18 under the password
	// hint. The rest of the column runs on the shared 14.
	divider: {
		marginBottom: 16
	},
	form: {
		gap: 14
	},
	nameField: {
		flex: 1
	},
	nameRow: {
		flexDirection: 'row',
		gap: 9
	},
	// The design sets this line smaller than a normal field message and flush with the
	// column, so it overrides both.
	passwordHint: {
		fontSize: 10.5,
		marginLeft: 0,
		marginTop: 6
	},
	social: {
		flexDirection: 'row',
		gap: 9,
		marginBottom: 16
	},
	submit: {
		marginTop: 4
	},
	terms: {
		fontSize: 10.5
	},
	verifyHint: {
		marginTop: 8
	}
});
