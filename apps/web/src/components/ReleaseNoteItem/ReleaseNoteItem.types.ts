import type { ReleaseNoteEntry } from '@/lib/content/releaseNotes';

export interface ReleaseNoteItemProps {
	entry: ReleaseNoteEntry;
	/**
	 * Whether a `isNew` entry wears its tag. The sheet (P1) is *entirely* new things and passes
	 * false; the full list (P3) shows several releases at once and is where the tag earns its
	 * place.
	 */
	hasNewTag?: boolean;
}
