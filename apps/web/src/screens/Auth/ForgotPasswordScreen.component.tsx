import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createForgotPasswordSchema, ForgotPasswordForm } from '@/lib/schemas/auth.schema';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { AuthStackParamList } from '@/navigation/types';
import { useSignIn } from '@clerk/expo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: ForgotPasswordScreenProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { signIn } = useSignIn();

	const [hasError, setHasError] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const schema = useMemo(() => createForgotPasswordSchema(t), [t]);

	const handleSendResetCode = useCallback(
		async (values: ForgotPasswordForm) => {
			if (!signIn) {
				return;
			}

			setHasError(false);
			setIsSubmitting(true);

			try {
				// The attempt has to know who it is for before a reset code can be sent.
				const { error } = await signIn.create({ identifier: values.email });

				if (error) {
					setHasError(true);
					return;
				}

				const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();

				if (sendError) {
					setHasError(true);
					return;
				}

				navigation.navigate('ResetCodeSent', { email: values.email });
			} finally {
				setIsSubmitting(false);
			}
		},
		[navigation, signIn]
	);

	return (
		<ScreenContainer>
			<ScreenHeader
				onBack={() => navigation.goBack()}
				style={styles.header}
				subtitle={t('fpSub')}
				title={t('fpTitle')}
			/>
			<Form<ForgotPasswordForm>
				defaultValues={{ email: '' }}
				isDisabled={isSubmitting}
				isFullHeight={false}
				schema={schema}
				render={({ handleSubmit }) => (
					<View style={styles.form}>
						<Field
							autoCapitalize='none'
							autoComplete='email'
							autoCorrect={false}
							autoFocus
							keyboardType='email-address'
							label={t('email')}
							name='email'
							onSubmitEditing={handleSubmit(handleSendResetCode)}
							returnKeyType='go'
							textContentType='emailAddress'
						/>
						{hasError ? <CaptionText color={theme.colors.danger}>{t('genericError')}</CaptionText> : null}
						<AppButton
							isLoading={isSubmitting}
							onPress={handleSubmit(handleSendResetCode)}
							style={styles.submit}
							title={t('sendLink')}
						/>
					</View>
				)}
			/>
			<Pressable onPress={() => navigation.popTo('SignIn')} style={styles.switchLink}>
				<BodyStrongText color={theme.colors.accent}>{t('backToSignIn')}</BodyStrongText>
			</Pressable>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	form: {
		gap: 14
	},
	// `ScreenHeader` already leaves 18 below the title; 01C wants 22 in total.
	header: {
		paddingBottom: 4
	},
	submit: {
		marginTop: 4
	},
	switchLink: {
		alignItems: 'center',
		marginTop: 18
	}
});
