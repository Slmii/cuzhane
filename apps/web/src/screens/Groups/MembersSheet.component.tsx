import { MemberRow } from '@/components/MemberRow/MemberRow.component';
import type { MemberRowRemoveProps } from '@/components/MemberRow/MemberRow.types';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
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
import { visibleMemberIdentity } from '@/lib/utils/groupPrivacy';
import { useCallback, useMemo } from 'react';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { MembersSheetProps } from './MembersSheet.types';
import { MembersSkeleton } from './MembersSkeleton.component';

/**
 * Three quarters of the screen — **one** height, deliberately.
 *
 * A list of twenty members genuinely runs long, but most groups are five or six and a
 * full-height sheet opened onto a screen of empty space below them.
 *
 * A second, taller stop looks harmless and isn't: the sheet sizes its content to the *largest*
 * one, because that is the height it may be dragged to. At the smaller one the bottom of that
 * content sits below the screen, and a scroll view inside it ends there too — so the list
 * scrolled to its end with the last members still off-screen, unreachable by any gesture. One
 * height keeps the content and the visible sheet the same size.
 */
const SHEET_HEIGHT_RATIO = 0.75;
/** Stood up once, because the memoised rows below depend on the identity of this list. */
const NO_MEMBERS: GroupMember[] = [];

/**
 * Who is in the group — a sheet rather than a pushed screen, because it is something you
 * glance at and dismiss rather than a place you go. It opens over the group you are
 * already looking at, so the board stays behind it and closing costs no navigation.
 */
export const MembersSheet = ({ groupId, isVisible, onClose }: MembersSheetProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const userId = useCurrentUserId();

	const groupQuery = useGetGroupById(groupId);
	// Only while open: closed, this sheet is still mounted and would otherwise refetch and
	// rebuild every row behind a surface that renders nothing.
	const membersQuery = useGetGroupMembers(groupId, isVisible);
	const removeGroupMember = useRemoveGroupMember();

	const detail = groupQuery.data;
	// `?? []` inline would be a new array every render, and the rows below are memoised on it.
	const members = membersQuery.data ?? NO_MEMBERS;
	const isPending = groupQuery.isPending || membersQuery.isPending;
	const isError = groupQuery.isError || membersQuery.isError || !detail;

	/*
	 * The rows are built once per change of data, not once per render of this sheet.
	 *
	 * Closing announces itself as the animation *starts*, which re-renders the screen that
	 * owns the sheet — and with the rows inline, twenty of them rebuilt in the first frames
	 * of the close. Each carries an avatar the SVG renderer has to draw, so the animation
	 * stuttered exactly where the share sheet, which has three elements, does not.
	 *
	 * Not a `FlatList`: this is capped at `spots`, which is 20, and virtualising inside a sheet
	 * buys nothing at that size. Twenty rows that never rebuild cost less than the machinery.
	 */
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

	const rows = useMemo(
		() =>
			members.map((cachedMember, index) => {
				const member = visibleMemberIdentity(cachedMember, detail, userId, t('hpAnonymousReader'));
				// Hidden by the group (S4): the server sends a stand-in id for anyone whose name is withheld.
				const isAnonymous =
					cachedMember.userId.startsWith('anonymous:') ||
					(detail?.hideMemberNames === true && !detail.isOwner && cachedMember.userId !== userId);
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
						key={member.id}
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
			}),
		[detail, handleRemovePress, members, t, userId]
	);

	const handleClose = () => {
		onClose();
	};

	return (
		<>
			{/*
			 * `snapPoints` alone now. `topInset` was the same measurement from the other end and
			 * the platform sheet has no equivalent — but 75% already leaves the quarter-screen
			 * strip that inset existed to keep, so saying it twice was the only thing lost.
			 */}
			<AppBottomSheet heightRatio={SHEET_HEIGHT_RATIO} isVisible={isVisible} onClose={handleClose}>
				{/*
				 * `flex: 1` on the scroller itself, not just its content. A sheet with fixed
				 * detents gives its body a fixed height, and a scroll view with no flex inside
				 * one takes the height of its *content* — so a list longer than the sheet grew
				 * past the bottom edge instead of scrolling, and the last members were
				 * unreachable because the scroller believed it was already showing everything.
				 */}
				<ScrollView
					contentContainerStyle={styles.body}
					showsVerticalScrollIndicator={false}
					style={styles.scroller}
				>
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
										{t(detail.isOwner ? 'hpNamesHiddenOwner' : 'hpNamesHiddenMember')}
									</CaptionText>
								</View>
							) : null}

							{/* One panel for the whole list, so it reads as its own surface against the
							    sheet — a card, not a card per member. */}
							<CardSurface isFlush>{rows}</CardSurface>

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
				</ScrollView>
			</AppBottomSheet>
		</>
	);
};

const styles = StyleSheet.create({
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
	body: {
		flexGrow: 1,
		paddingBottom: 26
	},
	scroller: {
		flex: 1
	},
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
