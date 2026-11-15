import { useRoundReset } from '@/lib/hooks/useRoundReset';
import type { GroupSummary } from '@/lib/types/domain';
import { ResetTimeLabel } from './ResetTimeLabel.component';

/**
 * A Cevşen or Kur'an card's next reset, in the reader's clock — "sende 23:00", "sende Pazar
 * 23:00" — or a one-off's end date. Nothing while a group gathers: it has no round to turn over.
 */
export const GroupResetTime = ({ group }: { group: GroupSummary }) => {
	const reset = useRoundReset({
		cycle: group.cycle,
		kind: group.kind,
		roundDays: group.roundDays,
		roundEndsAt: group.roundEndsAt,
		startedAt: group.startedAt,
		timezone: group.timezone
	});
	const label = reset ? reset.local || reset.group : null;

	return label ? <ResetTimeLabel label={label} /> : null;
};
