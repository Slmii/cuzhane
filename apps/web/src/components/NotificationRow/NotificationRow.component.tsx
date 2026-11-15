import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { AppNotification } from '@/lib/types/domain';
import { BodyStrongText, CaptionText, StatText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { notificationText, relativeAge } from '@/lib/utils/notifications';
import { StyleSheet, View } from 'react-native';
import type { NotificationRowProps } from './NotificationRow.types';

/**
 * One row of the inbox (design P2).
 *
 * **The sentence is built on the phone, not stored.** The server sends the data — a range, a
 * name, a round number — and `notificationText` composes it from the strings table, so a row reads in whatever
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

	/*
	 * A released claim is the one event that is a loss rather than news, so it wears the sand and
	 * clay the pool already uses for a missed bab; the other two take the group's sage.
	 */
	const isWarning = notification.kind === 'POOL_CLAIM_RELEASED' || notification.kind === 'MEMBER_LEFT';
	const tileBackground = isWarning ? theme.colors.sand : theme.colors.accentSoft;
	const tileColor = isWarning ? theme.colors.missed : theme.colors.accent;

	/*
	 * One glyph per kind. A lookup keyed on the kind rather than a chain of ternaries, which is
	 * what this was at three and would be an unreadable ladder at six. The two lines are
	 * `notificationText`'s, which picks bab, cüz or bölüm from the group's kind.
	 *
	 * **Every glyph here is the icon set's own, from "Bildirim türleri".** They used to borrow —
	 * `range` for a finished share, `completed` (the hatim mark) for a closed round, `memberCheck`
	 * for somebody joining — and each was legible alone while the column read as six unrelated
	 * marks, because every one had been drawn to mean something else somewhere else.
	 */
	const iconByKind: Record<AppNotification['kind'], IconName> = {
		POOL_CLAIM_RELEASED: 'claimReleased',
		SHARE_READ: 'shareRead',
		ROUND_COMPLETE: 'roundComplete',
		POOL_BAB_CLAIMED: 'poolTaken',
		MEMBER_JOINED: 'memberJoined',
		MEMBER_LEFT: 'memberLeft'
	};

	const icon = iconByKind[notification.kind];
	const { body, title } = notificationText(notification, t);

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
