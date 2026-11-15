import { MemberRow } from '@/components/MemberRow/MemberRow.component';
import type { MemberRowRemoveProps } from '@/components/MemberRow/MemberRow.types';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Header2 } from '@/components/ui/Typography/Typography.component';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetGroupMembers, useRemoveGroupMember } from '@/lib/hooks/useMembership';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupMember } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { visibleMemberIdentity } from '@/lib/utils/groupPrivacy';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { MembersSkeleton } from './MembersSkeleton.component';

/** Stood up once, because the list's data should keep its identity between renders. */
const NO_MEMBERS: GroupMember[] = [];

/**
 * Who is in the group — the members sheet's body, and a page of Yönet.
 *
 * **Windowed**: a Hizb plan group has no member limit, and every row draws an avatar, so the list
 * renders the rows in view rather than all of them. The heading and the note stay put above the
 * card; the rows scroll inside it, and the card hugs a short list rather than filling the sheet.
 *
 * `isActive` is whether it is on screen: while not, it is still mounted in its sheet and would
 * otherwise refetch behind a surface that renders nothing.
 */
export const MembersList = ({ groupId, isActive }: { groupId: string; isActive: boolean }) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const userId = useCurrentUserId();

	const groupQuery = useGetGroupById(groupId);
	const membersQuery = useGetGroupMembers(groupId, isActive);
	const removeGroupMember = useRemoveGroupMember();

	const detail = groupQuery.data;
	const members = membersQuery.data ?? NO_MEMBERS;
	const isPending = groupQuery.isPending || membersQuery.isPending;
	const isError = groupQuery.isError || membersQuery.isError || !detail;

	/*
	 * **The platform's confirm, not a sheet of our own.** It was a second `AppBottomSheet`
	 * stacked over this one, which a natively presented sheet cannot do — iOS refuses to present
	 * while another is on screen, so the confirmation simply never appeared. An `Alert` is also
	 * the right shape for it: one destructive question with two answers, which is what the OS
	 * dialog is for and what leaving a group and deleting an account already use.
	 */
	const handleRemovePress = useCallback(
		(member: GroupMember) => {
			confirmDestructive({
				cancelLabel: t('cancel'),
				confirmLabel: t('removeConfirm'),
				// A hatim member's cüz go back to the pool; a Cevşen member's range frees up.
				message: `${member.displayName} ${t(
					groupQuery.data?.kind === 'HATIM' ? 'removeBodyCuz' : 'removeBody'
				)}`,
				onConfirm: () => removeGroupMember.mutate({ groupId, memberUserId: member.userId }),
				title: t('removeTitle')
			});
		},
		[groupId, groupQuery.data?.kind, removeGroupMember, t]
	);

	/*
	 * Kept stable across renders, so the list redraws a row only when its data changes — closing the
	 * sheet re-renders its owner as the animation starts, and rebuilding every avatar then stuttered
	 * the close.
	 */
	const renderMember = useCallback<ListRenderItem<GroupMember>>(
		({ index, item: cachedMember }) => {
			const member = visibleMemberIdentity(cachedMember, detail, userId, t('hpAnonymousReader'));
			// Hidden by the group (S4): the server sends a stand-in id for anyone whose name is withheld.
			const isAnonymous =
				cachedMember.userId.startsWith('anonymous:') ||
				(detail?.hideMemberNames === true &&
					!detail.isOwner &&
					!detail.seesReaders &&
					cachedMember.userId !== userId);
			// Spread as a pair: the remove button is a bare glyph, so its accessibility label
			// travels with the handler rather than being optional beside it. Annotated rather
			// than inlined so the conditional keeps the union instead of widening to two
			// independently-optional props.
			const removeProps: MemberRowRemoveProps =
				detail?.isOwner === true && member.role !== 'OWNER'
					? {
							onRemove: () => handleRemovePress(member),
							removeLabel: `${t('remove')} — ${member.displayName}`
					  }
					: {};

			return (
				<MemberRow
					imageUrl={member.imageUrl}
					isAnonymous={isAnonymous}
					name={member.displayName}
					percent={member.percent}
					rangeLabel={formatBabRange(member.babNumbers)}
					// The card's own edge closes the list; a hairline under the last row
					// would draw a second one just inside it.
					style={index === members.length - 1 ? styles.lastRow : undefined}
					tag={member.userId === userId ? t('you') : member.role === 'OWNER' ? t('admin') : undefined}
					{...removeProps}
				/>
			);
		},
		[detail, handleRemovePress, members.length, t, userId]
	);

	return (
		<View style={styles.page}>
			<Header2 style={styles.title}>{t('membersTitle')}</Header2>

			{isPending ? (
				<MembersSkeleton />
			) : isError ? (
				<View style={styles.centered}>
					<EmptyState
						actionLabel={t('retry')}
						onAction={() => {
							groupQuery.refetch();
							membersQuery.refetch();
						}}
						title={t('genericError')}
					/>
				</View>
			) : (
				<>
					<CaptionText color={theme.colors.subtext} style={styles.subtitle}>
						{detail.splitMode === 'FLEXIBLE'
							? t('flexibleMembers', { count: detail.memberCount })
							: `${detail.memberCount} / ${detail.spots} · ${detail.spotsLeft} ${t('spotsLeft')}`}
					</CaptionText>

					{/* S4, as on Okuyanlar: members are told names are hidden; the owner, that only they see them. */}
					{detail.hideMemberNames ? (
						<View style={[styles.hiddenNote, { backgroundColor: theme.colors.sand }]}>
							<Icon color={theme.colors.sandText} name='lock' size={16} strokeWidth={1.8} />
							<CaptionText color={theme.colors.sandText} style={styles.hiddenNoteText}>
								{t(
									detail.isOwner
										? 'hpNamesHiddenOwner'
										: detail.seesReaders
										? 'hpNamesHiddenSeer'
										: 'hpNamesHiddenMember'
								)}
							</CaptionText>
						</View>
					) : null}

					{/* One panel for the whole list, so it reads as its own surface against the
					    sheet — a card, not a card per member. It shrinks to its rows, and scrolls
					    them once there are more than the sheet can hold. */}
					<CardSurface isFlush style={styles.card}>
						<FlatList
							data={members}
							initialNumToRender={12}
							keyExtractor={member => member.id}
							maxToRenderPerBatch={12}
							renderItem={renderMember}
							showsVerticalScrollIndicator={false}
							windowSize={7}
						/>
					</CardSurface>

					{detail.isOwner ? (
						<View style={styles.ownerHint}>
							<View style={[styles.ownerDot, { backgroundColor: theme.colors.accent }]} />
							<CaptionText color={theme.colors.faintText}>{`${t('youAdmin')} — `}</CaptionText>
							<Icon color={theme.colors.faintText} name='close' size={13} strokeWidth={1.9} />
							<CaptionText color={theme.colors.faintText}>{t('remove')}</CaptionText>
						</View>
					) : null}
				</>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	// The sheet gives the column its height; the card takes what the heading and note leave.
	page: {
		flex: 1,
		paddingBottom: 26
	},
	card: {
		flexShrink: 1,
		overflow: 'hidden'
	},
	// Okuyanlar's (T5) note, measure for measure.
	hiddenNote: {
		alignItems: 'center',
		borderRadius: 14,
		flexDirection: 'row',
		gap: 10,
		marginBottom: 12,
		paddingHorizontal: 14,
		paddingVertical: 11
	},
	hiddenNoteText: { flex: 1, fontSize: 11.5, lineHeight: 16.7 },
	centered: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	lastRow: {
		borderBottomWidth: 0
	},
	ownerDot: {
		borderRadius: 4,
		height: 7,
		width: 7
	},
	ownerHint: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 4,
		paddingHorizontal: 4,
		paddingTop: 12
	},
	subtitle: {
		marginBottom: 14,
		marginTop: 6
	},
	title: {
		fontSize: 24,
		lineHeight: 29
	}
});
