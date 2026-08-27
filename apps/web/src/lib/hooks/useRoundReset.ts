import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupCycle } from '@/lib/types/domain';
import { roundResetLabels, timeUntilReset, type RoundResetLabels } from '@/lib/utils/roundReset';
import { useMemo } from 'react';

type ResetInput = {
	roundEndsAt: string | null;
	cycle: GroupCycle;
	timezone: string;
};

/**
 * The reset lines for a group, in the app's current language.
 *
 * `Intl` formatters are not cheap to build and a Groups list makes one card per group, so
 * the labels are memoised on the three inputs that can actually change them.
 */
export const useRoundReset = ({ cycle, roundEndsAt, timezone }: ResetInput): RoundResetLabels | null => {
	const { language, t } = useTranslation();

	return useMemo(
		() => roundResetLabels(roundEndsAt, cycle, timezone, language, t),
		[cycle, language, roundEndsAt, t, timezone]
	);
};

/**
 * Hours and minutes left in the round — the DAILY screen's countdown, where "1 gün" would
 * be both wrong and useless.
 *
 * Recomputed on render rather than ticked: the group screen already refetches on focus and
 * on its live interval, so the number refreshes when anything else on the screen does, and
 * a per-second timer would rerender the board for a digit nobody is watching.
 */
export const useTimeUntilReset = (roundEndsAt: string | null) =>
	useMemo(() => timeUntilReset(roundEndsAt), [roundEndsAt]);
