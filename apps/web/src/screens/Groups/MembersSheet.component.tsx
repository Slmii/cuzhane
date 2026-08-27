import { MemberRow } from '@/components/MemberRow/MemberRow.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText, Header2, Typography } from '@/components/ui/Typography/Typography.component';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetGroupMembers, useRemoveGroupMember } from '@/lib/hooks/useMembership';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupMember } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { MembersSheetProps } from './MembersSheet.types';

/** Matches the join flow: a tall sheet that still shows a strip of the screen beneath. */
const SHEET_TOP_INSET = 52;
const SHEET_SNAP_POINTS = ['100%'];

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
	const membersQuery = useGetGroupMembers(groupId);
	const removeGroupMember = useRemoveGroupMember();

	const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);

	const detail = groupQuery.data;
	const members = membersQuery.data ?? [];
	const isPending = groupQuery.isPending || membersQuery.isPending;
	const isError = groupQuery.isError || membersQuery.isError || !detail;

	const handleClose = () => {
		setMemberToRemove(null);
		onClose();
	};

	const handleConfirmRemove = () => {
		if (!memberToRemove) {
			return;
		}

		removeGroupMember.mutate({ groupId, memberUserId: memberToRemove.userId });
		setMemberToRemove(null);
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
				<BottomSheetScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
					<Header2 style={styles.title}>{t('membersTitle')}</Header2>

					{isPending ? (
						<View style={styles.centered}>
							<ActivityIndicator color={theme.colors.accent} />
						</View>
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

							<CardSurface isFlush>
								{members.map(member => {
									const isSelf = member.userId === userId;
									const isMemberOwner = member.role === 'OWNER';

									return (
										<MemberRow
											key={member.id}
											name={member.displayName}
											onRemove={
												detail.isOwner && !isMemberOwner
													? () => setMemberToRemove(member)
													: undefined
											}
											percent={member.percent}
											rangeLabel={formatBabRange(member.babNumbers)}
											tag={isSelf ? t('you') : isMemberOwner ? t('admin') : undefined}
										/>
									);
								})}
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
				</BottomSheetScrollView>
			</AppBottomSheet>

			{/* Stacked over the list rather than replacing it: removing someone is a decision
			    about one row, and the row it is about should stay on screen behind it. */}
			<AppBottomSheet isVisible={memberToRemove !== null} onClose={() => setMemberToRemove(null)}>
				<Header2 style={styles.removeTitle}>{t('removeTitle')}</Header2>
				<Typography color={theme.colors.subtext} style={styles.removeBody}>
					<BodyStrongText color={theme.colors.text}>{memberToRemove?.displayName}</BodyStrongText>
					{` ${t('removeBody')}`}
				</Typography>
				<View style={styles.removeActions}>
					<AppButton onPress={handleConfirmRemove} title={t('removeConfirm')} variant='danger' />
					<AppButton onPress={() => setMemberToRemove(null)} title={t('cancel')} variant='surface' />
				</View>
			</AppBottomSheet>
		</>
	);
};

const styles = StyleSheet.create({
	body: {
		flexGrow: 1,
		paddingBottom: 26
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
	removeActions: {
		gap: 9
	},
	removeBody: {
		marginBottom: 18,
		marginTop: 8
	},
	removeTitle: {
		fontSize: 21
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
