import type { GroupCycle, GroupKind } from '@/lib/types/domain';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { roundResetLabels, timeUntilReset, type RoundResetLabels } from '@/lib/utils/roundReset';
import { useMemo } from 'react';

type ResetInput = {
	roundEndsAt: string | null;
	/** Whether the group repeats at all — a CUSTOM one states an end date instead. */
	cycle: GroupCycle;
	/** How many days the round runs — see `roundResetLabels` for why not the cadence. */
	roundDays: number;
	/** A Hizb group's MONTHLY is a calendar month, anyone else's thirty days. */
	kind: GroupKind;
	timezone: string;
	/**
	 * Names a MONTHLY group's day of the month — see `roundResetLabels`. Required, so a screen
	 * cannot quietly name the clamped day where the group screen names the start's.
	 */
	startedAt: string | null;
};

/**
 * The reset lines for a group, in the app's current language.
 *
 * `Intl` formatters are not cheap to build and a Groups list makes one card per group, so
 * the labels are memoised on the inputs that can actually change them.
 */
export const useRoundReset = ({
	cycle,
	kind,
	roundDays,
	roundEndsAt,
	startedAt,
	timezone
}: ResetInput): RoundResetLabels | null => {
	const { language, t } = useTranslation();

	return useMemo(
		() => roundResetLabels(roundEndsAt, cycle, roundDays, timezone, language, t, kind, startedAt),
		[cycle, kind, language, roundDays, roundEndsAt, startedAt, t, timezone]
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
