import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { AppNotification } from '@/lib/types/domain';
import { BodyStrongText, CaptionText, StatText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { relativeAge } from '@/lib/utils/notifications';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';
import type { NotificationRowProps } from './NotificationRow.types';

/**
 * One row of the inbox (design P2).
 *
 * **The sentence is built here, not stored.** The server sends the data — a range, a name, a
 * round number — and this composes it from the strings table, so a row reads in whatever
 * language the reader is in now and picks up copy edits. It is also why `groupName` rides on the
 * row: the group it names may since have been renamed or deleted.
 *
 * **The glyph is the icon set, not a typographic character.** The frame draws `۱۸`, `✓` and `!`
 * in Newsreader inside a tinted tile; the tile is kept and the character is not, because the
 * icon rules refuse a `✓` as an icon and the drawn set already carries a mark for each of these
 * three events.
 */
export const NotificationRow = ({ notification, now }: NotificationRowProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const { count, unit } = relativeAge(notification.createdAt, now);
	const when =
		unit === 'now'
			? t('notifNow')
			: unit === 'minutes'
			? t('notifMinutes', { count })
			: unit === 'hours'
			? t('notifHours', { count })
			: t('notifDays', { count });

	const payload = notification.payload;
	const range = typeof payload.range === 'string' ? payload.range : '';
	const readerName = typeof payload.readerName === 'string' ? payload.readerName : '';
	const roundNumber = typeof payload.roundNumber === 'number' ? payload.roundNumber : 0;
	const startBab = typeof payload.startBab === 'number' ? payload.startBab : 0;
	const endBab = typeof payload.endBab === 'number' ? payload.endBab : 0;
	const memberName = typeof payload.memberName === 'string' ? payload.memberName : '';
	const takerName = typeof payload.takerName === 'string' ? payload.takerName : '';
	const memberCount = typeof payload.memberCount === 'number' ? payload.memberCount : 0;
	const spots = typeof payload.spots === 'number' ? payload.spots : 0;

	/*
	 * A released claim is the one event that is a loss rather than news, so it wears the sand and
	 * clay the pool already uses for a missed bab; the other two take the group's sage.
	 */
	const isWarning = notification.kind === 'POOL_CLAIM_RELEASED' || notification.kind === 'MEMBER_LEFT';
	const tileBackground = isWarning ? theme.colors.sand : theme.colors.accentSoft;
	const tileColor = isWarning ? theme.colors.missed : theme.colors.accent;

	/*
	 * One entry per kind, each naming its own glyph and its own two lines. A lookup keyed on the
	 * kind rather than a chain of ternaries, which is what this was at three and would be an
	 * unreadable ladder at six.
	 *
	 * **Every glyph here is the icon set's own, from "Bildirim türleri".** They used to borrow —
	 * `range` for a finished share, `completed` (the hatim mark) for a closed round, `memberCheck`
	 * for somebody joining — and each was legible alone while the column read as six unrelated
	 * marks, because every one had been drawn to mean something else somewhere else.
	 */
	const copyByKind: Record<AppNotification['kind'], { body: string; icon: IconName; title: string }> = {
		POOL_CLAIM_RELEASED: {
			body: t('notifPoolReleasedBody'),
			icon: 'claimReleased',
			title: t('notifPoolReleasedTitle', { range: `${startBab}–${endBab}` })
		},
		SHARE_READ: {
			body: t('notifShareReadBody', { range }),
			icon: 'shareRead',
			title: t('notifShareReadTitle', { name: readerName })
		},
		ROUND_COMPLETE: {
			body: t('notifRoundCompleteBody'),
			icon: 'roundComplete',
			title: t('notifRoundCompleteTitle', { round: roundNumber })
		},
		POOL_BAB_CLAIMED: {
			body: t('notifPoolClaimedBody', { range }),
			icon: 'poolTaken',
			title: t('notifPoolClaimedTitle', { name: takerName })
		},
		MEMBER_JOINED: {
			body: t('notifMemberJoinedBody', { count: memberCount, spots }),
			icon: 'memberJoined',
			title: t('notifMemberJoinedTitle', { name: memberName })
		},
		MEMBER_LEFT: {
			body: t('notifMemberLeftBody', { count: memberCount, spots }),
			icon: 'memberLeft',
			title: t('notifMemberLeftTitle', { name: memberName })
		}
	};

	/*
	 * **Q8 — the same events about a hatim.** The cüz goes into the title beside the person
	 * ("Ayşe · 29. cüz") and the body says what they did with it; a closed round is the hatim
	 * itself, "Tur 3 · 30 / 30"; and the member lines count people, because a hatim has no seats
	 * for "{count}/{spots}" to fill. A released pool claim is a Cevşen seat event and has no twin.
	 */
	const hatimCopy: Partial<Record<AppNotification['kind'], { body: string; title: string }>> = {
		MEMBER_JOINED: { body: t('notifMembersBody', { count: memberCount }), title: copyByKind.MEMBER_JOINED.title },
		MEMBER_LEFT: { body: t('notifMembersBody', { count: memberCount }), title: copyByKind.MEMBER_LEFT.title },
		POOL_BAB_CLAIMED: { body: t('notifCuzTookBody'), title: t('notifCuzTitle', { name: takerName, range }) },
		ROUND_COMPLETE: {
			body: t('notifHatimDoneBody', { count: CUZ_COUNT, round: roundNumber }),
			title: t('notifHatimDoneTitle')
		},
		SHARE_READ: { body: t('notifCuzReadBody'), title: t('notifCuzTitle', { name: readerName, range }) }
	};

	const { icon } = copyByKind[notification.kind];
	const { body, title } =
		(notification.groupKind === 'HATIM' ? hatimCopy[notification.kind] : undefined) ??
		copyByKind[notification.kind];

	return (
		/*
		 * **A record, not a control.** Rows used to open the group they were about and mark
		 * themselves read on the way; they are inert now, so nothing here is a `Pressable` and
		 * nothing carries a button role. The inbox says what happened — where to go about it is
		 * the shelf's job, and it is one tab away.
		 *
		 * **Every row keeps the surface**, read or not. Letting a read one fall through to the
		 * page made the list look half-drawn — a column of cards with gaps in it — rather than
		 * settled. Unread still reads as unread: the title holds its weight and the dot stays.
		 */
		<View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider }]}>
			<View style={[styles.tile, { backgroundColor: tileBackground }]}>
				<Icon color={tileColor} name={icon} size={17} strokeWidth={1.8} />
			</View>
			<View style={styles.copy}>
				<View style={styles.titleRow}>
					<BodyStrongText style={styles.title} weight={notification.isRead ? 'regular' : 'semibold'}>
						{title}
					</BodyStrongText>
					<StatText color={theme.colors.faintText}>{when}</StatText>
				</View>
				<CaptionText color={theme.colors.subtext}>
					{notification.groupName} · {body}
				</CaptionText>
			</View>
			{notification.isRead ? null : <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />}
		</View>
	);
};

const styles = StyleSheet.create({
	copy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	dot: {
		borderRadius: 4,
		height: 8,
		marginTop: 6,
		width: 8
	},
	row: {
		alignItems: 'flex-start',
		borderRadius: 15,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 13,
		paddingVertical: 12
	},
	tile: {
		alignItems: 'center',
		borderRadius: 11,
		height: 34,
		justifyContent: 'center',
		width: 34
	},
	title: {
		flex: 1,
		minWidth: 0
	},
	titleRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8
	}
});
