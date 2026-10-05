import { DELAIL_REPETITIONS } from '@/lib/content/hizbDelail';
import type { ReactNode } from 'react';
import { RepetitionBox } from '@/components/RepetitionBox/RepetitionBox.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { DelailProgress } from './HizbBody.types';

/**
 * T1d for the Delâil salavat, read three times: the box holds the salavat alone, so the sentence
 * after it is plainly not part of the repetition.
 */
export const DelailReading = ({ children, progress }: { children: ReactNode; progress: DelailProgress }) => {
	const { t } = useTranslation();

	return (
		<RepetitionBox
			count={progress.count}
			disabled={progress.disabled}
			max={DELAIL_REPETITIONS}
			note={progress.sessionOnly ? t('hpIstighfarSession') : undefined}
			onCountChange={progress.onChange}
			target={DELAIL_REPETITIONS}
		>
			{children}
		</RepetitionBox>
	);
};
