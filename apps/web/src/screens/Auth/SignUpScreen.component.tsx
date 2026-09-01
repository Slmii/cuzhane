import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { SocialAuthButton } from '@/components/ui/SocialAuthButton/SocialAuthButton.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AuthDivider } from './AuthDivider.component';
// Google's official four-colour mark, which their sign-in guidelines require. A PNG because it
// is artwork rather than a glyph — see `AppButton`'s `imageIcon`.
const googleMark = require('@/assets/brand/google.png');

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

	/*
	 * **On the code step, back means the form — not "leave sign-up".** The two are one screen
	 * with two states, so the navigator's back would otherwise throw away a sign-up attempt that
	 * has already been created and a code that has already been sent, and the reader would have
	 * to start over to correct a typo in their address.
	 *
	 * `beforeRemove` rather than a `headerLeft` of our own: it catches **Android's hardware and
	 * gesture back** as well as the button in the bar, which a replaced header control cannot.
	 * That is the case this was written for — on iOS the swipe is the same story.
	 *
	 * It does not fire when the whole navigator unmounts, which is what happens on success, so
	 * verifying still leaves for the app rather than being held here.
	 */
	useEffect(() => {
		if (!isPendingVerification) {
			return;
		}

		return navigation.addListener('beforeRemove', event => {
			event.preventDefault();
			setIsPendingVerification(false);
		});
	}, [isPendingVerification, navigation]);
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
					password: values.password
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
				{/* The same header as the form step, so the title clears the navigator's back
				    button instead of being drawn under it. */}
				<ScreenHeader hasBackButton subtitle={t('verifyEmailHint')} title={t('verifyEmailTitle')} />
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
							{/*
							 * Verify is the only button here. There used to be a "Geri" ghost
							 * below it, because the navigator's back leaves sign-up altogether
							 * while this step wants to return to the *form* — two controls that
							 * both said back and did different things. The effect above makes the
							 * one in the bar mean the nearer of the two, which is also what
							 * Android's hardware back has to mean on this step.
							 */}
							<AppButton
								isLoading={isSubmitting}
								onPress={handleSubmit(handleVerify)}
								title={t('verify')}
							/>
						</View>
					)}
				/>
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer>
			<ScreenHeader hasBackButton subtitle={t('signUpSub')} title={t('signUpTitle')} />
			<View style={styles.social}>
				<SocialAuthButton
					isLoading={isGoogleSigningIn}
					label='Google'
					imageIcon={googleMark}
					style={styles.socialButton}
					onPress={() => handleSSO('oauth_google', setIsGoogleSigningIn)}
				/>
				{isAppleAvailable ? (
					<SocialAuthButton
						isLoading={isAppleSigningIn}
						label='Apple'
						onPress={() => handleSSO('oauth_apple', setIsAppleSigningIn)}
						style={styles.socialButton}
						systemIcon='apple.logo'
						variant='primary'
					/>
				) : null}
			</View>
			<AuthDivider style={styles.divider} />
			<Form<SignUpForm>
				isFullHeight={false}
				defaultValues={{ email: '', password: '' }}
				isDisabled={isSubmitting}
				schema={signUpSchema}
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
	// Half the row each. The button no longer sizes itself, so the share has to be named here —
	// and it must be `flex`, not a width: a glass button asked to measure its own width reports
	// it back and overrides whatever the row wanted.
	socialButton: {
		flex: 1
	},
	submit: {
		marginTop: 4
	},
	terms: {
		fontSize: 10.5
	}
});
