import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CodeInput } from '@/components/ui/CodeInput/CodeInput.component';
import { BodyStrongText, CaptionText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { describeClerkError } from '@/lib/utils/clerkErrors';
import { AuthStackParamList } from '@/navigation/types';
import { useSignIn } from '@clerk/expo';
import type { SignInStatus } from '@clerk/types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

type ResetCodeSentScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetCodeSent'>;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The attempt is only ready for a code once `create()` and `sendCode()` have run. Landing
 * here in any other state means there is nothing to verify *against* — a reload dropped
 * the attempt — and Clerk rejects the call with an error that has nothing to do with the
 * digits on screen.
 */
const AWAITING_CODE: SignInStatus = 'needs_first_factor';

export const ResetCodeSentScreen = ({ navigation, route }: ResetCodeSentScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { signIn } = useSignIn();
	const inputRef = useRef<TextInput | null>(null);

	const [code, setCode] = useState('');
	// Which message to show, not just whether to show one: a mistyped digit is the
	// ordinary case here and deserves to say so.
	const [errorKey, setErrorKey] = useState<'codeInvalid' | 'resetExpired' | 'genericError' | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

	useEffect(() => {
		if (secondsLeft <= 0) {
			return;
		}

		const timer = setTimeout(() => setSecondsLeft(current => current - 1), 1000);

		return () => clearTimeout(timer);
	}, [secondsLeft]);

	const handleChangeText = (next: string) => {
		setErrorKey(null);
		setCode(next.replace(/\D/g, '').slice(0, CODE_LENGTH));
	};

	const handleVerify = useCallback(async () => {
		if (!signIn) {
			return;
		}

		// Ask first, so a dead attempt can't be reported as a mistyped code.
		if (signIn.status !== AWAITING_CODE) {
			setErrorKey('resetExpired');
			return;
		}

		setErrorKey(null);
		setIsSubmitting(true);

		try {
			const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });

			if (error) {
				// The attempt *was* waiting for exactly this code, so a rejection here is
				// about the digits — whatever Clerk names it. Logged in dev rather than
				// whitelisted, because a guessed list of codes is what got this wrong before.
				if (__DEV__) {
					console.warn('[reset] verifyCode rejected:', describeClerkError(error));
				}

				setErrorKey('codeInvalid');
				return;
			}

			navigation.navigate('SetNewPassword');
		} finally {
			setIsSubmitting(false);
		}
	}, [code, navigation, signIn]);

	const handleResend = useCallback(async () => {
		if (!signIn || secondsLeft > 0) {
			return;
		}

		setErrorKey(null);
		const { error } = await signIn.resetPasswordEmailCode.sendCode();

		if (error) {
			// Nothing to do with the digits on screen — a failed *send* is always generic.
			setErrorKey('genericError');
			return;
		}

		setCode('');
		setSecondsLeft(RESEND_COOLDOWN_SECONDS);
	}, [secondsLeft, signIn]);

	return (
		<ScreenContainer contentContainerStyle={styles.content}>
			<View style={styles.header}>
				<View style={[styles.iconTile, { backgroundColor: theme.colors.accentSoft }]}>
					<View style={[styles.envelope, { borderColor: theme.colors.accent }]} />
				</View>
				<Header1 style={styles.title} textAlign='center'>
					{t('sentTitle')}
				</Header1>
				<CaptionText color={theme.colors.subtext} style={styles.subtitle} textAlign='center'>
					{t('sentSub', { email: route.params.email })}
				</CaptionText>
			</View>
			<View style={styles.codeWrap}>
				<CodeInput
					hasError={errorKey !== null}
					length={CODE_LENGTH}
					onPress={() => inputRef.current?.focus()}
					value={code}
				/>
				<TextInput
					autoComplete='one-time-code'
					autoFocus
					keyboardType='number-pad'
					maxLength={CODE_LENGTH}
					onChangeText={handleChangeText}
					ref={inputRef}
					style={styles.hiddenInput}
					textContentType='oneTimeCode'
					value={code}
				/>
			</View>
			{errorKey ? (
				<CaptionText color={theme.colors.danger} textAlign='center'>
					{t(errorKey)}
				</CaptionText>
			) : null}
			<View style={styles.actions}>
				<AppButton
					disabled={code.length !== CODE_LENGTH}
					isLoading={isSubmitting}
					onPress={handleVerify}
					title={t('continue')}
				/>
				<CaptionText color={theme.colors.faintText} style={styles.noMail} textAlign='center'>
					{t('noMail')}
				</CaptionText>
				<Pressable disabled={secondsLeft > 0} onPress={handleResend} style={styles.resend}>
					<BodyStrongText color={secondsLeft > 0 ? theme.colors.subtext : theme.colors.accent}>
						{secondsLeft > 0 ? t('resendIn', { seconds: secondsLeft }) : t('resend')}
					</BodyStrongText>
				</Pressable>
			</View>
			<Pressable onPress={() => navigation.popTo('SignIn')} style={styles.switchLink}>
				<BodyStrongText color={theme.colors.accent}>{t('backToSignIn')}</BodyStrongText>
			</Pressable>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	actions: {
		gap: 10,
		marginTop: 4
	},
	codeWrap: {
		marginTop: 22
	},
	content: {
		justifyContent: 'center'
	},
	// 22x15 outline standing in for a sealed envelope, per the design.
	envelope: {
		borderRadius: 3,
		borderWidth: 1.5,
		height: 15,
		width: 22
	},
	header: {
		alignItems: 'center'
	},
	// Off-screen but focusable: the visible boxes are painted by `CodeInput`.
	hiddenInput: {
		height: 1,
		opacity: 0,
		position: 'absolute',
		width: 1
	},
	iconTile: {
		alignItems: 'center',
		borderRadius: 18,
		height: 56,
		justifyContent: 'center',
		marginBottom: 18,
		width: 56
	},
	noMail: {
		lineHeight: 18,
		marginTop: 2
	},
	resend: {
		alignItems: 'center',
		paddingVertical: 2
	},
	subtitle: {
		lineHeight: 20,
		marginTop: 10,
		maxWidth: 250
	},
	switchLink: {
		alignItems: 'center',
		marginTop: 22
	},
	title: {
		fontSize: 26
	}
});
