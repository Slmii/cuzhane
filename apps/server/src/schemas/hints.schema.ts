import { z } from 'zod';

/** The app's own name for a hint, e.g. `reader.readMark`. Unknown ones are accepted. */
export const HintIdSchema = z.string().regex(/^[a-z][a-zA-Z0-9.]{0,63}$/);

export const MarkHintsSeenBodySchema = z.object({
	ids: z.array(HintIdSchema).min(1).max(20)
});

export type MarkHintsSeenBody = z.infer<typeof MarkHintsSeenBodySchema>;
