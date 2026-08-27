import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Field } from '@/components/ui/Form/Field/Field.component';
import { Form } from '@/components/ui/Form/Form.component';
import { PasswordStrength } from '@/components/ui/PasswordStrength/PasswordStrength.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { createNewPasswordSchema, NewPasswordForm, PASSWORD_MIN_LENGTH } from '@/lib/schemas/auth.schema';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useSignIn } from '@clerk/expo';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

// The last step of the reset flow: no back affordance, and finishing it signs the
// user in, which unmounts the auth stack entirely.
export const SetNewPasswordScreen = () => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { signIn } = useSignIn();

	const [hasError, setHasError] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const schema = useMemo(() => createNewPasswordSchema(t), [t]);

	const handleSavePassword = useCallback(
		async (values: NewPasswordForm) => {
			if (!signIn) {
				return;
			}

			setHasError(false);
			setIsSubmitting(true);

			try {
				const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password: values.password });

				if (error) {
					setHasError(true);
					return;
				}

				// Resetting leaves the attempt complete but inactive; finalize is what
				// signs the user in and unmounts this stack.
				const { error: finalizeError } = await signIn.finalize();

				if (finalizeError) {
					setHasError(true);
				}
			} finally {
				setIsSubmitting(false);
			}
		},
		[signIn]
	);

	return (
		<ScreenContainer>
			<ScreenHeader
				style={styles.header}
				subtitle={t('newPwSub', { count: PASSWORD_MIN_LENGTH })}
				title={t('newPwTitle')}
			/>
			<Form<NewPasswordForm>
				defaultValues={{ confirmPassword: '', password: '' }}
				isDisabled={isSubmitting}
				isFullHeight={false}
				mode='onChange'
				schema={schema}
				render={({ handleSubmit, watch }) => {
					const password = watch('password');
					const confirmPassword = watch('confirmPassword');
					const isMatching = password.length > 0 && password === confirmPassword;

					return (
						<View style={styles.form}>
							<View style={styles.group}>
								<Field
									autoCapitalize='none'
									autoComplete='new-password'
									autoCorrect={false}
									autoFocus
									label={t('newPassword')}
									name='password'
									secureTextEntry
									textContentType='newPassword'
								/>
								<PasswordStrength password={password} />
							</View>
							<View style={styles.group}>
								<Field
									autoCapitalize='none'
									autoComplete='new-password'
									autoCorrect={false}
									label={t('confirmPassword')}
									name='confirmPassword'
									onSubmitEditing={handleSubmit(handleSavePassword)}
									returnKeyType='go'
									secureTextEntry
									textContentType='newPassword'
								/>
								{isMatching ? (
									<View style={styles.matchRow}>
										<Icon color={theme.colors.accent} name='check' size={13} />
										<CaptionText color={theme.colors.accent} style={styles.matchNote}>
											{t('pwMatch')}
										</CaptionText>
									</View>
								) : null}
							</View>
							{hasError ? (
								<CaptionText color={theme.colors.danger}>{t('genericError')}</CaptionText>
							) : null}
							<AppButton
								isLoading={isSubmitting}
								onPress={handleSubmit(handleSavePassword)}
								style={styles.submit}
								title={t('savePassword')}
							/>
						</View>
					);
				}}
			/>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	form: {
		gap: 16
	},
	group: {
		gap: 8
	},
	// `ScreenHeader` already leaves 18 below the title; 01E wants 22 in total.
	header: {
		paddingBottom: 4
	},
	matchNote: {
		fontSize: 10.5
	},
	matchRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 4
	},
	// The "passwords match" line carries 20 below it, not the form's shared 16.
	submit: {
		marginTop: 4
	}
});
