import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { GroupDetailSkeleton } from './GroupDetailSkeleton.component';
import { LobbySkeleton } from './LobbySkeleton.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { SpotsGrid } from '@/components/ui/SpotsGrid/SpotsGrid.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import {
	BodyText,
	CaptionText,
	EyebrowText,
	NumericText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetGroupById, useStartGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'Lobby'>;

/**
 * A group that hasn't started yet. The owner sees the fill and the button that opens day
 * 1 (design 06a); everyone else sees the range being held for them, marked provisional
 * because nothing is committed until the owner starts (06b).
 */
export const LobbyScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const group = useGetGroupById(groupId);
	const startGroup = useStartGroup();

	// 06a is the creator's lobby and the only one there is. A member waiting for the group
	// to start has a designed screen of their own — the same "you're in, waiting" state they
	// saw on joining — so they are sent there rather than shown a second, near-identical one.
	const isOwner = group.data?.isOwner;

	useEffect(() => {
		if (isOwner === false) {
			navigation.replace('JoinedWelcome', { groupId });
		}
	}, [groupId, isOwner, navigation]);
	const updateGroup = useUpdateGroup();

	const [hasCopied, setHasCopied] = useState(false);

	if (group.isLoading) {
		return (
			<ScreenContainer isScrollable={false}>
				<LobbySkeleton />
			</ScreenContainer>
		);
	}

	if (group.isError || !group.data) {
		return (
			<ScreenContainer isScrollable>
				<EmptyState actionLabel={t('retry')} onAction={() => group.refetch()} title={t('genericError')} />
			</ScreenContainer>
		);
	}

	const detail = group.data;
	const openSpots = detail.spots - detail.memberCount;
	const fillPercent = Math.round((detail.memberCount / detail.spots) * 100);

	const handleCopyInvite = async () => {
		if (!detail.inviteCode) {
			return;
		}

		// The code itself, with the display dash stripped — there is no invite URL to build.
		await Clipboard.setStringAsync(detail.inviteCode.replace(/-/g, ''));
		setHasCopied(true);
	};

	const handleStart = () => {
		// `replace`, not `navigate`: the lobby is gone the moment the hatim starts, and
		// leaving it in the stack would let a back swipe return to a screen that no
		// longer describes the group.
		// Straight to the board: the state change is the message, so there is no interstitial
		// to confirm it. `replace` so the lobby isn't left behind to swipe back into.
		startGroup.mutate(groupId, { onSuccess: () => navigation.replace('GroupDetail', { groupId }) });
	};

	const fillCard = (
		<CardSurface style={styles.fillCard}>
			<View style={styles.fillRow}>
				<NumericText color={theme.colors.accent}>{detail.memberCount}</NumericText>
				<CaptionText color={theme.colors.faintText}>{`/ ${detail.spots} ${t('joinedCount')}`}</CaptionText>
				{detail.isOwner ? (
					<CaptionText color={theme.colors.faintText} style={styles.openSpots}>
						{`${openSpots} ${t('openSpots')}`}
					</CaptionText>
				) : null}
			</View>
			<ProgressBar percent={fillPercent} style={styles.fillBar} />
			<SpotsGrid filled={detail.memberCount} total={detail.spots} />
			{detail.isOwner ? (
				<CaptionText color={theme.colors.subtext} style={styles.poolNote}>
					{t('poolNote')}
				</CaptionText>
			) : null}
		</CardSurface>
	);

	// The redirect above has already fired; hold rather than flash the creator's lobby. It
	// shows the *group* screen's skeleton, since that is where a non-owner is being sent.
	if (!detail.isOwner) {
		return (
			<ScreenContainer>
				<GroupDetailSkeleton />
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer shouldIncludeTabBarOffset>
			<ScreenHeader onBack={navigation.goBack} subtitle={t('notCounting')} title={detail.name} />
			<View style={styles.stateRow}>
				<EyebrowText color={theme.colors.faintText}>{t('creator')}</EyebrowText>
				<Chip label={t('lobbyState')} tone='sand' />
			</View>
			{fillCard}
			<CardSurface isFlush style={styles.inviteCard}>
				<View style={[styles.inviteBlock, { borderBottomColor: theme.colors.border }]}>
					<EyebrowText color={theme.colors.faintText} style={styles.inviteLabel}>
						{t('inviteLink')}
					</EyebrowText>
					<View style={styles.inviteRow}>
						{/* The code set as type rather than as a monospaced URL fragment — it is
						    something the creator reads out, not a string to be transcribed. */}
						<Typography
							color={theme.colors.accent}
							numberOfLines={1}
							style={styles.inviteValue}
							variant='title'
							weight='regular'
						>
							{detail.inviteCode ?? '—'}
						</Typography>
						<AppButton
							// Buttons default to full width; here it sits beside the code, so
							// it has to shrink to its label or the code has nowhere to go.
							fullWidth={false}
							{...(hasCopied ? { icon: 'check' as const } : {})}
							onPress={() => void handleCopyInvite()}
							size='sm'
							title={hasCopied ? t('copied') : t('copyInvite')}
							variant='surface'
						/>
					</View>
				</View>
				<ToggleRow
					hint={t('autoStartHint')}
					onValueChange={value => updateGroup.mutate({ autoStartWhenFull: value, groupId })}
					title={t('autoStartFull')}
					value={detail.autoStartWhenFull}
				/>
			</CardSurface>
			<AppButton isLoading={startGroup.isPending} onPress={handleStart} title={t('startNow')} />
			<BodyText color={theme.colors.faintText} style={styles.startHint} textAlign='center'>
				{t('startHint')}
			</BodyText>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	centered: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	fillBar: {
		marginBottom: 13,
		marginTop: 10
	},
	fillCard: {
		marginBottom: 11
	},
	fillRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8
	},
	inviteBlock: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		padding: 15
	},
	inviteCard: {
		marginBottom: 11
	},
	inviteLabel: {
		marginBottom: 7
	},
	inviteRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	inviteValue: {
		// 16/1 Newsreader with the design's .06em tracking, a step up from `title`'s 17/23.
		flex: 1,
		fontSize: 16,
		letterSpacing: 0.96,
		lineHeight: 21
	},
	loading: {
		flex: 1
	},
	openSpots: {
		marginLeft: 'auto'
	},
	poolNote: {
		marginTop: 12
	},
	reservedCard: {
		marginBottom: 11,
		paddingVertical: 20
	},
	reservedHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center',
		marginBottom: 9
	},
	reservedNote: {
		marginTop: 9
	},
	startHint: {
		marginTop: 11
	},
	stateRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 10
	}
});
