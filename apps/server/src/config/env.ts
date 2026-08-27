import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production']).default('development'),
	PORT: z.coerce.number().int().positive().default(3001),
	CORS_ORIGIN: z.string().default('*'),

	CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
	CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),

	DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

	// Treat an unset key and a present-but-blank one the same way: `.env.example`
	// ships this blank, and a bare `.optional()` would reject '' and block boot.
	APP_STORE_URL: z.preprocess(value => (value === '' ? undefined : value), z.string().url().optional())
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	const message = parsed.error.issues.map(issue => issue.message).join(', ');
	throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = parsed.data;
