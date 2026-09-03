import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SocialAuthButton } from '@/components/ui/SocialAuthButton/SocialAuthButton.component';
// Google's official four-colour mark, which their sign-in guidelines require. A PNG because it
// is artwork rather than a glyph — see `AppButton`'s `imageIcon`.
const googleMark = require('@/assets/brand/google.png');
import {
	BodyStrongText,
	CaptionText,
	FieldLabelText,
	Header1,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createSignInSchema, SignInForm } from '@/lib/schemas/auth.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { describeClerkError } from '@/lib/utils/clerkErrors';
import { classifySignInError, type SignInError } from '@/lib/utils/signInErrors';
import { AuthStackParamList } from '@/navigation/types';
import { useSignIn } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { AuthDivider } from './AuthDivider.component';

type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

/**
 * A2e's banner rises into place (`om-rise`) rather than appearing, and is keyed on the error's
 * kind so a *different* failure rises again where the same one repeated would only re-render.
 */
const RISE_KEYFRAMES = {
	'0%': { opacity: 0, transform: [{ translateY: 10 }] },
	'100%': { opacity: 1, transform: [{ translateY: 0 }] }
};

const riseAnimation = {
	...RISE_KEYFRAMES['0%'],
	animationDuration: 320,
	animationFillMode: 'both' as const,
	animationName: RISE_KEYFRAMES,
	animationTimingFunction: cubicBezier(0.2, 0.9, 0.3, 1)
};

const BANNER_ICON_DISC = 26;
const BANNER_ICON_SIZE = 15;
const STRIP_ICON_SIZE = 13;

export const SignInScreen = ({ navigation }: SignInScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const isReducedMotion = useReducedMotion();
	// Core 3's signal-based hook: `signIn` is the future resource, and every call
	// resolves to `{ error }` rather than throwing.
	const { signIn } = useSignIn();
	const { startSSOFlow } = useSSO();

	/*
	 * Which failure is on screen: offline, or the one generic banner every refusal shares.
	 * `isExtraVerification` is the one failure that gets no banner, because it isn't an error
	 * so much as a feature the app lacks.
	 */
	const [signInError, setSignInError] = useState<SignInError | null>(null);
	const [isExtraVerification, setIsExtraVerification] = useState(false);
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
	const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);

	const isAppleAvailable = Platform.OS === 'ios';

	const schema = useMemo(() => createSignInSchema(t), [t]);

	const showError = useCallback((error: SignInError) => setSignInError(error), []);

	const clearErrors = useCallback(() => {
		setSignInError(null);
		setIsExtraVerification(false);
	}, []);

	const handleSignIn = useCallback(
		async (values: SignInForm) => {
			if (!signIn) {
				return;
			}

			clearErrors();
			setIsSigningIn(true);

			try {
				const { error } = await signIn.password({ identifier: values.email, password: values.password });

				if (error) {
					if (__DEV__) {
						console.warn('[signIn] password rejected:', describeClerkError(error));
					}

					showError(classifySignInError(error));
					return;
				}

				// The password is only the first factor. An account with MFA or device trust
				// enrolled stops short of 'complete', and finalizing there fails with an error
				// that reads as "wrong password" — so say what is actually happening instead.
				if (signIn.status !== 'complete') {
					if (__DEV__) {
						console.warn('[signIn] attempt not complete:', signIn.status);
					}

					setIsExtraVerification(true);
					return;
				}

				// `finalize()` promotes the completed attempt to the active session, which is
				// what flips `useAuth()` over to signed-in.
				const { error: finalizeError } = await signIn.finalize();

				if (finalizeError) {
					showError(classifySignInError(finalizeError));
				}
			} finally {
				setIsSigningIn(false);
			}
		},
		[clearErrors, showError, signIn]
	);

	// The experimental SSO hook is the Core 3 one — it drives the future resources and
	// activates the completed session itself, so there is no finalize step here. Its failures
	// carry no Clerk code to read, so they are all "us".
	const handleSSO = useCallback(
		async (strategy: 'oauth_google' | 'oauth_apple', setBusy: (value: boolean) => void) => {
			clearErrors();
			setBusy(true);

			try {
				const { createdSessionId } = await startSSOFlow({ strategy });

				if (!createdSessionId) {
					showError({ kind: 'server' });
				}
			} catch {
				showError({ kind: 'server' });
			} finally {
				setBusy(false);
			}
		},
		[clearErrors, showError, startSSOFlow]
	);

	const kind = signInError?.kind;

	// Two banners: offline names the connection, everything else shares one generic line. No
	// field-level messages — the banner deliberately doesn't say which field was wrong.
	const bannerTitle = kind === 'offline' ? t('errOfflineTitle') : t('errServerTitle');
	const bannerBody = kind === 'offline' ? t('errOfflineBody') : t('errServerBody');
	const submitLabel = signInError ? t('errTryAgain') : t('signInTitle');
	const footnote =
		kind === 'server' && signInError?.status !== undefined
			? t('errServerFoot', { code: signInError.status })
			: undefined;

	return (
		<ScreenContainer contentContainerStyle={styles.content}>
			{/* Pinned above everything while the request that failed never left the phone. It
			    says the one thing the banner's body can't: this is still true right now. */}
			{kind === 'offline' ? (
				<View style={[styles.strip, { backgroundColor: theme.colors.text }]}>
					<Icon color={theme.colors.background} name='searchOff' size={STRIP_ICON_SIZE} strokeWidth={1.8} />
					<Typography
						color={theme.colors.background}
						style={styles.stripLabel}
						variant='stat'
						weight='semibold'
					>
						{t('errOfflineStrip')}
					</Typography>
				</View>
			) : null}
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
				render={({ handleSubmit }) => {
					// The banner's one action is a resubmit, which is why it lives inside the
					// render prop where `handleSubmit` is.
					const retry = () => void handleSubmit(handleSignIn)();

					return (
						<View style={styles.form}>
							{signInError ? (
								<Animated.View
									key={signInError.kind}
									style={[
										styles.banner,
										{
											backgroundColor: toAlphaColor(theme.colors.danger, 0.09),
											borderColor: toAlphaColor(theme.colors.danger, 0.16)
										},
										isReducedMotion ? null : riseAnimation
									]}
								>
									<View
										style={[
											styles.bannerDisc,
											{ backgroundColor: toAlphaColor(theme.colors.danger, 0.12) }
										]}
									>
										<Icon
											color={theme.colors.danger}
											name='info'
											size={BANNER_ICON_SIZE}
											strokeWidth={1.9}
										/>
									</View>
									<View style={styles.bannerCopy}>
										<Typography
											color={theme.colors.danger}
											style={styles.bannerTitle}
											variant='bodyStrong'
										>
											{bannerTitle}
										</Typography>
										<CaptionText
											color={toAlphaColor(theme.colors.danger, 0.85)}
											style={styles.bannerBody}
										>
											{bannerBody}
										</CaptionText>
										<View style={styles.bannerActions}>
											<AppButton
												fullWidth={false}
												onPress={retry}
												size='sm'
												title={t('errTryAgain')}
												variant='danger'
											/>
										</View>
									</View>
								</Animated.View>
							) : null}
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
							{isExtraVerification ? (
								<CaptionText color={theme.colors.danger}>{t('extraVerification')}</CaptionText>
							) : null}
							<AppButton
								isLoading={isSigningIn}
								onPress={handleSubmit(handleSignIn)}
								style={styles.submit}
								title={submitLabel}
							/>
							{/* Always laid out, so the form doesn't shift when a footnote arrives. */}
							<CaptionText color={theme.colors.faintText} style={styles.footnote} textAlign='center'>
								{footnote ?? ''}
							</CaptionText>
						</View>
					);
				}}
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
	banner: {
		alignItems: 'flex-start',
		borderRadius: 16,
		borderWidth: 1,
		flexDirection: 'row',
		gap: 11,
		marginBottom: 4,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	bannerActions: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginTop: 11
	},
	bannerBody: {
		fontSize: 11.5,
		lineHeight: 18,
		marginTop: 5
	},
	bannerCopy: {
		flex: 1,
		minWidth: 0
	},
	bannerDisc: {
		alignItems: 'center',
		borderRadius: BANNER_ICON_DISC / 2,
		height: BANNER_ICON_DISC,
		justifyContent: 'center',
		marginTop: 1,
		width: BANNER_ICON_DISC
	},
	bannerTitle: {
		fontSize: 12.5,
		lineHeight: 17
	},
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
	footnote: {
		fontSize: 11,
		marginTop: 2,
		minHeight: 16
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
	strip: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		marginBottom: 18,
		paddingHorizontal: 16,
		paddingVertical: 7
	},
	stripLabel: {
		fontSize: 10.5,
		letterSpacing: 0.3,
		textTransform: 'none'
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
