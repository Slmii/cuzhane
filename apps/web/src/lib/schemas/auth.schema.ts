import type { StringKey } from '@/lib/i18n/strings';
import * as z from 'zod';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

/**
 * Mirrors the Clerk instance's `password_settings.min_length`. Clerk is the authority —
 * it rejects anything shorter with `form_password_length_too_short` — so this exists only
 * to say so before the round trip. Change it here *and* in the Dashboard together, or the
 * form will happily accept a password the API refuses.
 */
export const PASSWORD_MIN_LENGTH = 8;
const VERIFICATION_CODE_LENGTH = 6;

/**
 * Schemas are factories rather than module constants because the messages are
 * user-facing and this app is bilingual — a static schema would bake in one language.
 */
export const createSignInSchema = (t: Translate) =>
	z.object({
		email: z.string().trim().min(1, t('fieldRequired')).email(t('invalidEmail')),
		password: z.string().min(1, t('fieldRequired'))
	});

export type SignInForm = z.infer<ReturnType<typeof createSignInSchema>>;

export const createSignUpSchema = (t: Translate) =>
	z.object({
		firstName: z.string().trim().min(1, t('fieldRequired')),
		lastName: z.string().trim().min(1, t('fieldRequired')),
		email: z.string().trim().min(1, t('fieldRequired')).email(t('invalidEmail')),
		password: z.string().min(PASSWORD_MIN_LENGTH, t('passwordTooShort', { count: PASSWORD_MIN_LENGTH }))
	});

export type SignUpForm = z.infer<ReturnType<typeof createSignUpSchema>>;

export const createVerificationSchema = (t: Translate) =>
	z.object({
		code: z.string().trim().length(VERIFICATION_CODE_LENGTH, t('codeIncomplete'))
	});

export type VerificationForm = z.infer<ReturnType<typeof createVerificationSchema>>;

export const createForgotPasswordSchema = (t: Translate) =>
	z.object({
		email: z.string().trim().min(1, t('fieldRequired')).email(t('invalidEmail'))
	});

export type ForgotPasswordForm = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

export const createNewPasswordSchema = (t: Translate) =>
	z
		.object({
			password: z.string().min(PASSWORD_MIN_LENGTH, t('passwordTooShort', { count: PASSWORD_MIN_LENGTH })),
			confirmPassword: z.string().min(1, t('fieldRequired'))
		})
		.refine(values => values.password === values.confirmPassword, {
			message: t('passwordsDontMatch'),
			path: ['confirmPassword']
		});

export type NewPasswordForm = z.infer<ReturnType<typeof createNewPasswordSchema>>;
