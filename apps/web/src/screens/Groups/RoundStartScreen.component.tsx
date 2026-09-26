import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { NoteCard } from '@/components/ui/NoteCard/NoteCard.component';
import { OptionCard } from '@/components/ui/OptionCard/OptionCard.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { cuzSuraRange } from '@/lib/content/cuz';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById, useGetPoolCuz, usePickRoundCuz, useSkipRound } from '@/lib/hooks/useGroup';
import { markRoundScreenSeen } from '@/lib/utils/roundScreensSeen';
import { useGetMyProgress } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RoundStartSkeleton } from './RoundStartSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'RoundStart'>;

type Choice = 'keep' | 'new' | 'skip';

/**
 * QR1 — a hatim's new round, opening. Two readings of one frame, chosen by why it is shown:
 *
 * - **`pick`: the member holds no cüz, and the group will not open until they answer.** Under
 *   "Yeniden seçilir" that is everyone, every round; under "Cüzler korunur", whoever held only
 *   loans. The frame's three choices: the same cüz again (offered only while every one of them
 *   is still free), a fresh pick on the map, or sitting the round out. If nothing is free at all
 *   the choices give way to "Bu turda boş cüz kalmadı" and the one way in, which is the skip.
 * - **`carried`: "Cüzler korunur" brought their cüz over.** No choices — a kept group does not
 *   swap — just which cüz this round holds, once.
 *
 * **Left out of the frame, deliberately:** its caption ("Cevap vermezsen cüzlerin korunur") and
 * hints were written for a free choice at every round, and its warning about a notification
 * after 24 hours describes nothing that exists. The eyebrow is "Tur 4" rather than "Tur 3 → 4":
 * an arrow in a string is the one kind of glyph the icon rules refuse.
 */
export const RoundStartScreen = ({ navigation, route }: Props) => {
	const { groupId, reason } = route.params;
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	const groupQuery = useGetGroupById(groupId);
	const progressQuery = useGetMyProgress(groupId);
	const poolQuery = useGetPoolCuz(groupId);
	const pick = usePickRoundCuz();
	const skip = useSkipRound();
	const userId = useCurrentUserId();
	const [choice, setChoice] = useState<Choice | null>(null);

	const detail = groupQuery.data;
	const isPick = reason === 'pick';
	const hasAnswered = detail !== undefined && (detail.myBabNumbers.length > 0 || detail.hasSkippedRound);

	/*
	 * **Answered is answered, however it happened** — a pick here, the map's own pick on the
	 * screen pushed from here, or a skip. The group opens in this screen's place, so back from
	 * it leaves the group rather than returning to a question already answered.
	 *
	 * **Only once this screen is on top.** A screen's `replace` acts on the top of the stack, not
	 * on the screen that calls it: answered from the map, the refetch landed while the map was
	 * still up, the group replaced the *map*, and the map's own `goBack` then popped the group —
	 * leaving this question on screen with the cüz already held, and the map showing it taken.
	 */
	const isFocused = useIsFocused();

	useEffect(() => {
		if (isPick && hasAnswered && isFocused) {
			navigation.replace('GroupDetail', { groupId });
		}
	}, [groupId, hasAnswered, isFocused, isPick, navigation]);

	if (groupQuery.isPending || progressQuery.isPending || (isPick && poolQuery.isPending)) {
		return (
			// Laid out as the screen is, so the skeleton's button sits at the foot where the real one will.
			<ScreenContainer contentContainerStyle={styles.content} isScrollable>
				<RoundStartSkeleton isPick={isPick} />
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || progressQuery.isError || (isPick && poolQuery.isError) || !detail) {
		return <ErrorState queries={[groupQuery, progressQuery, poolQuery]} />;
	}

	const roundIndex = detail.roundIndex ?? 0;
	const lastRound = progressQuery.data?.periods.find(period => period.roundIndex === roundIndex - 1);
	const lastUnits = lastRound?.units ?? [];
	const lastNumbers = lastUnits.map(unit => unit.number);
	const free = new Set((poolQuery.data ?? []).filter(cuz => cuz.takenByUserId === null).map(cuz => cuz.cuzNumber));

	// "The same again" only when it can actually be granted: every one still free, and within
	// the cap. Offered and then refused would be a choice the screen knew it could not keep.
	const canKeep =
		lastNumbers.length > 0 &&
		lastNumbers.every(number => free.has(number)) &&
		(detail.maxPerMember === null || lastNumbers.length <= detail.maxPerMember);
	const hasNoFreeCuz = free.size === 0;

	const list = (numbers: number[]) =>
		numbers.length <= 1
			? numbers.join('')
			: `${numbers.slice(0, -1).join(', ')} ${t('listAnd')} ${numbers[numbers.length - 1]}`;

	const handleConfirm = async () => {
		if (choice === 'keep') {
			// Picked again rather than carried: this round's carried-over note does not apply.
			// Written before the pick, so the group screen that follows finds it.
			if (userId) {
				await markRoundScreenSeen('cuzCarried', userId, groupId, roundIndex);
			}

			pick.mutate({ cuzNumbers: lastNumbers, groupId });
		} else if (choice === 'new') {
			navigation.navigate('PickCuz', { groupId, isRoundPick: true });
		} else if (choice === 'skip') {
			skip.mutate(groupId);
		}
	};

	const cuzRows = (numbers: number[], readOf?: (number: number) => boolean) =>
		numbers.map((number, index) => {
			const isRead = readOf?.(number) ?? false;

			return (
				<View
					key={number}
					style={[
						styles.cuzRow,
						index > 0
							? { borderTopColor: theme.colors.divider, borderTopWidth: StyleSheet.hairlineWidth }
							: null
					]}
				>
					<View
						style={[
							styles.cuzTile,
							{ backgroundColor: readOf && !isRead ? theme.colors.missedSurface : theme.colors.accent }
						]}
					>
						<Typography
							color={readOf && !isRead ? theme.colors.missed : theme.colors.onAccent}
							style={styles.cuzNumeral}
							variant='display'
						>
							{number}
						</Typography>
					</View>
					<View style={styles.cuzCopy}>
						<CaptionText weight='semibold'>{t('qCuzTitle', { n: number })}</CaptionText>
						<CaptionText color={theme.colors.subtext}>{cuzSuraRange(number, language)}</CaptionText>
					</View>
					{isRead ? <Icon color={theme.colors.accent} name='check' size={15} strokeWidth={2} /> : null}
				</View>
			);
		});

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			<View style={styles.body}>
				<ScreenHeader
					eyebrow={t('qRoundN', { n: roundIndex + 1 })}
					hasBackButton
					// With nothing free there is nothing to pick — the one way on is sitting it out.
					subtitle={t(
						isPick ? (hasNoFreeCuz ? 'qNewRoundSubNoFree' : 'qNewRoundSubPick') : 'qNewRoundSubCarried'
					)}
					title={t('qNewRoundTitle')}
				/>

				{isPick ? (
					lastUnits.length > 0 ? (
						<CardSurface isFlush>
							<View style={[styles.cardHead, { backgroundColor: theme.colors.accentSoft }]}>
								<EyebrowText color={theme.colors.accent}>{t('qLastRoundYours')}</EyebrowText>
								<CaptionText color={theme.colors.accent} weight='semibold'>
									{`${lastUnits.filter(unit => unit.isRead).length} / ${lastUnits.length} ${t(
										'done'
									)}`}
								</CaptionText>
							</View>
							{cuzRows(lastNumbers, number =>
								lastUnits.some(unit => unit.number === number && unit.isRead)
							)}
						</CardSurface>
					) : null
				) : (
					<CardSurface isFlush>
						<View style={[styles.cardHead, { backgroundColor: theme.colors.accentSoft }]}>
							<EyebrowText color={theme.colors.accent}>{t('qThisRoundYours')}</EyebrowText>
						</View>
						{cuzRows(detail.myBabNumbers)}
					</CardSurface>
				)}

				{isPick && hasNoFreeCuz ? (
					<>
						<CardSurface style={styles.noFree}>
							<CaptionText weight='semibold'>{t('qNoFreeCuzTitle')}</CaptionText>
						</CardSurface>
						<NoteCard text={t('qNoFreeCuzSub')} />
					</>
				) : null}

				{isPick && !hasNoFreeCuz ? (
					<View style={styles.options}>
						{canKeep ? (
							<OptionCard
								hint={t('qKeepMineHint', { list: list(lastNumbers) })}
								isSelected={choice === 'keep'}
								onPress={() => setChoice('keep')}
								title={t('qKeepMine')}
							/>
						) : null}
						<OptionCard
							hint={t('qPickNewHint')}
							isSelected={choice === 'new'}
							onPress={() => setChoice('new')}
							title={t('qPickNew')}
						/>
						<OptionCard
							hint={t('qSkipRoundHint')}
							isSelected={choice === 'skip'}
							onPress={() => setChoice('skip')}
							title={t('qSkipRound')}
						/>
					</View>
				) : null}
			</View>

			<View style={styles.footer}>
				{isPick ? (
					<AppButton
						disabled={!hasNoFreeCuz && choice === null}
						isLoading={pick.isPending || skip.isPending}
						// With nothing free, the one way in is the skip.
						onPress={hasNoFreeCuz ? () => skip.mutate(groupId) : handleConfirm}
						title={t(hasNoFreeCuz ? 'next' : 'qConfirm')}
					/>
				) : (
					<AppButton onPress={() => navigation.goBack()} title={t('next')} />
				)}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	body: {
		gap: 12
	},
	cardHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	cuzCopy: {
		flex: 1,
		gap: 1,
		minWidth: 0
	},
	cuzNumeral: {
		fontSize: 14,
		lineHeight: 18
	},
	cuzRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	cuzTile: {
		alignItems: 'center',
		borderRadius: 10,
		height: 34,
		justifyContent: 'center',
		width: 34
	},
	footer: {
		marginTop: 22
	},
	noFree: {
		alignItems: 'center',
		padding: 18
	},
	options: {
		gap: 9
	}
});
