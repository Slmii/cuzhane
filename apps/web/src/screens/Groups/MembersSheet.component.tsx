import { MemberRow } from '@/components/MemberRow/MemberRow.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
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
import { useCallback, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { MembersSheetProps } from './MembersSheet.types';
import { MembersSkeleton } from './MembersSkeleton.component';

/**
 * Three quarters of the screen — **one** detent, deliberately.
 *
 * A list of twenty members genuinely runs long, but most groups are five or six and a
 * full-height sheet opened onto a screen of empty space below them.
 *
 * A second, taller detent looks harmless and isn't: the sheet sizes its content to the
 * *largest* snap point, because that is the height it may be dragged to. At the smaller one
 * the bottom of that content sits below the screen, and a scroll view inside it ends there
 * too — so the list scrolled to its end with the last members still off-screen, unreachable
 * by any gesture. One detent keeps the content and the visible sheet the same height.
 */
const SHEET_SNAP_POINTS = ['75%'];
/** Stood up once, because the memoised rows below depend on the identity of this list. */
const NO_MEMBERS: GroupMember[] = [];
/** Keeps the sheet clear of the notch even at its tallest. */
const SHEET_TOP_INSET = 52;

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
	 * Not a `FlatList`: this is capped at `spots`, which is 20, and virtualising inside a
	 * gorhom sheet means `BottomSheetFlatList` plus a fixed `getItemLayout` to avoid
	 * measurement jank. Twenty rows that never rebuild cost less than that machinery.
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
			Alert.alert(t('removeTitle'), `${member.displayName} ${t('removeBody')}`, [
				{ style: 'cancel', text: t('cancel') },
				{
					onPress: () => removeGroupMember.mutate({ groupId, memberUserId: member.userId }),
					style: 'destructive',
					text: t('removeConfirm')
				}
			]);
		},
		[groupId, removeGroupMember, t]
	);

	const rows = useMemo(
		() =>
			members.map(member => (
				<MemberRow
					imageUrl={member.imageUrl}
					key={member.id}
					name={member.displayName}
					onRemove={detail?.isOwner && member.role !== 'OWNER' ? () => handleRemovePress(member) : undefined}
					percent={member.percent}
					rangeLabel={formatBabRange(member.babNumbers)}
					tag={member.userId === userId ? t('you') : member.role === 'OWNER' ? t('admin') : undefined}
				/>
			)),
		[detail?.isOwner, handleRemovePress, members, t, userId]
	);

	const handleClose = () => {
		onClose();
	};

	return (
		<>
			<AppBottomSheet
				hasScrollableContent
				isVisible={isVisible}
				onClose={handleClose}
				snapPoints={SHEET_SNAP_POINTS}
				topInset={SHEET_TOP_INSET}
			>
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
								{`${detail.memberCount} / ${detail.spots} · ${detail.spotsLeft} ${t('spotsLeft')}`}
							</CaptionText>

							<View>{rows}</View>

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
