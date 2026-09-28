import { useState, type ReactNode } from 'react';
import { RepetitionBox } from '@/components/RepetitionBox/RepetitionBox.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { IstighfarProgress } from './HizbBody.types';

/** The istighfar's own ceiling: its target is the reader's, from 1 to 100. */
const MAX = 100;

/**
 * T1d for the opening istighfar's repeated sentence — the one repetition whose target the reader
 * chooses. Planned readings are controlled by their saved assignment; free reading keeps a session
 * counter.
 */
export const IstighfarReading = ({ children, progress }: { children: ReactNode; progress?: IstighfarProgress }) => {
	const { t } = useTranslation();
	const [localCount, setLocalCount] = useState(0);
	const [localTarget, setLocalTarget] = useState(11);

	return (
		<RepetitionBox
			count={progress?.count ?? localCount}
			disabled={progress?.disabled ?? false}
			max={MAX}
			note={!progress || progress.sessionOnly ? t('hpIstighfarSession') : undefined}
			onCountChange={next =>
				progress ? progress.onChange({ istighfarRepetitions: next }) : setLocalCount(next)
			}
			onTargetChange={next => (progress ? progress.onChange({ istighfarTarget: next }) : setLocalTarget(next))}
			target={progress?.target ?? localTarget}
		>
			{children}
		</RepetitionBox>
	);
};
