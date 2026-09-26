import { WrapperApiError } from '@/api/wrapper.api';
import { CuzMap, CuzMapLegend } from '@/components/CuzMap/CuzMap.component';
import type { CuzCellState } from '@/components/CuzMap/CuzMap.types';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { cuzSuraRange } from '@/lib/content/cuz';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById, useGetPoolCuz, usePickRoundCuz } from '@/lib/hooks/useGroup';
import { useGroupPreviewById, useJoinGroup } from '@/lib/hooks/useMembership';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { markRoundScreenSeen } from '@/lib/utils/roundScreensSeen';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { PickCuzSkeleton } from './PickCuzSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'PickCuz'>;

/**
 * QJ3 — joining a hatim, which means **taking cüz rather than taking a seat**.
 *
 * Built against the frame: heading, a card holding the map and its key, a card of the cüz
 * chosen so far — each row removable — and a CTA carrying the count. Its own screen rather
 * than a step on the preview: the preview reports and this commits.
 *
 * It is also what stops the preview posting a join with nothing in it, which the server
 * refuses ("you cannot be in a hatim and hold no cüz") and which reached the reader as an
 * unhandled error on the tap. **The frame's "Şimdilik cüzsüz katıl" is therefore not built:**
 * it is the one thing on this screen that could only ever produce that refusal.
 */
export const PickCuzScreen = ({ navigation, route }: Props) => {
	const { groupId, inviteCode, isRoundPick = false } = route.params;
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	/*
	 * **Two readers of one map.** A joiner reads the invite preview; a member choosing again at
	 * a new round (QR1's "Farklı cüz seç") reads the group and its havuz instead — a private
	 * group's preview is not theirs to fetch, and the havuz is what says which cüz are free this
	 * round. An empty id is what switches a query off, so only one pair is ever fetched.
	 */
	const preview = useGroupPreviewById(isRoundPick ? '' : groupId, inviteCode);
	const group = useGetGroupById(isRoundPick ? groupId : '');
	const pool = useGetPoolCuz(isRoundPick ? groupId : '');
	const join = useJoinGroup();
	const pickRound = usePickRoundCuz();
	const userId = useCurrentUserId();
	const [selected, setSelected] = useState<number[]>([]);

	if (isRoundPick ? group.isLoading || pool.isLoading : preview.isLoading) {
		// Laid out as the screen is, so the skeleton's button sits at the foot where the real one will.
		return (
			<ScreenContainer contentContainerStyle={styles.content} isScrollable>
				<PickCuzSkeleton />
			</ScreenContainer>
		);
	}

	const freeNumbers = isRoundPick
		? pool.data?.filter(cuz => cuz.takenByUserId === null).map(cuz => cuz.cuzNumber)
		: preview.data?.poolBabNumbers;
	const maxPerMember = isRoundPick ? group.data?.maxPerMember : preview.data?.maxPerMember;

	if (freeNumbers === undefined || maxPerMember === undefined) {
		return <ErrorState queries={isRoundPick ? [group, pool] : [preview]} />;
	}

	const free = new Set(freeNumbers);
	const isAtCap = maxPerMember !== null && selected.length >= maxPerMember;

	// Three states, as the frame draws them: what you have chosen, what somebody already
	// holds, and what is still going.
	const stateOf = (number: number): CuzCellState =>
		selected.includes(number) ? 'mine' : free.has(number) ? 'free' : 'taken';
	/*
	 * **Only your own picks are named.** The frame writes the holder's name under every
	 * taken cell; nobody here has joined the group yet, so who is reading what is not theirs
	 * to see — and the server no longer sends it. "sen" under the cells you have just chosen
	 * is about you, and stays.
	 */
	const labelOf = (number: number) => (selected.includes(number) ? t('qYou') : '');

	const handleToggle = (number: number) => {
		setSelected(current =>
			current.includes(number)
				? current.filter(value => value !== number)
				: [...current, number].sort((a, b) => a - b)
		);
	};

	const handleJoin = async () => {
		if (isRoundPick) {
			// Chosen now, not carried over: this round's "your cüz carried over" note does not
			// apply. Written first, so the group screen that follows can never read it unwritten.
			if (userId && group.data?.roundIndex !== null && group.data?.roundIndex !== undefined) {
				await markRoundScreenSeen('cuzCarried', userId, groupId, group.data.roundIndex);
			}

			try {
				await pickRound.mutateAsync({ cuzNumbers: selected, groupId });
			} catch {
				// The hook has already said why; the map refreshes to show what changed.
				return;
			}

			// Back to QR1, which sees the cüz now held and opens the group in its own place.
			navigation.goBack();

			return;
		}

		/*
		 * A refused join says why, the way the round pick does. A 409 is somebody taking one of
		 * these cüz first: the preview refetches, and the picks no longer free are dropped so the
		 * next tap does not post the same refusal again.
		 */
		try {
			const joined = await join.mutateAsync({
				cuzNumbers: selected,
				groupId,
				...(inviteCode ? { inviteCode } : {})
			});

			navigation.replace('JoinedWelcome', { groupId: joined.id });
		} catch (error) {
			const isTaken = error instanceof WrapperApiError && error.status === 409;

			Alert.alert(t(isTaken ? 'qCuzJustTaken' : 'genericError'));

			if (isTaken) {
				const refreshed = await preview.refetch();
				const stillFree = new Set(refreshed.data?.poolBabNumbers ?? []);

				setSelected(current => current.filter(number => stillFree.has(number)));
			}
		}
	};

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			<View>
				<ScreenHeader
					hasBackButton
					subtitle={maxPerMember === null ? t('qPickSub') : t('qPickSubCapped', { count: maxPerMember })}
					title={t('qPickTitle')}
				/>

				<CardSurface style={styles.mapCard}>
					{/*
					 * How far into the choice you are, above the thing you are choosing with.
					 * Against a cap it is the whole rule in three characters — "2 / 5" says
					 * both what you hold and what is left without a sentence — and uncapped it
					 * still answers "how many have I picked", which the map alone makes you
					 * count for yourself.
					 */}
					<View style={styles.pickHead}>
						<CaptionText weight='semibold'>{t('qPickYours')}</CaptionText>
						<CaptionText color={theme.colors.accent} weight='semibold'>
							{/* Uncapped says so, rather than leaving the missing "/ N" to imply it. */}
							{maxPerMember === null
								? `${selected.length} ${t('cuz')} · ${t('qNoMax')}`
								: `${selected.length} / ${maxPerMember}`}
						</CaptionText>
					</View>
					<CuzMap
						/*
						 * **A cap stops selection, it does not hide cells.** At the cap the
						 * unchosen cells stop responding but stay legible — greying the other
						 * twenty-seven would say they are taken, which is a different and worse
						 * claim. Chosen cells always answer, so the way out of a full selection
						 * is to drop one.
						 */
						isPressable={number => free.has(number) && (!isAtCap || selected.includes(number))}
						labelOf={labelOf}
						onPress={handleToggle}
						stateOf={stateOf}
					/>
					{/* "boşta", not "havuz" — the frame's own word here, and the right one: on
					    the screen where you are choosing, a hatched cell is a cüz going spare
					    rather than a pool being pointed at. Every other board keeps "havuz". */}
					<CuzMapLegend freeLabel={t('qFree')} mineLabel={t('qSelected')} />
				</CardSurface>

				{/*
				 * What each chosen number actually is. A cüz is a span of the Kuran, not a
				 * label — "22" says nothing about whether you are agreeing to Ahzâb or to
				 * Yâsîn — and this is the moment the choice is made.
				 */}
				{selected.length > 0 ? (
					<CardSurface isFlush style={styles.selectedCard}>
						{selected.map(number => (
							<View
								key={number}
								style={[
									styles.selectedRow,
									{
										borderBottomColor: theme.colors.divider,
										borderBottomWidth: StyleSheet.hairlineWidth
									}
								]}
							>
								<View style={[styles.selectedNumber, { backgroundColor: theme.colors.accent }]}>
									{/* The display face, as the frame sets it — a numeral here is
									    the same kind of mark as the one on the ring. */}
									<Typography
										color={theme.colors.onAccent}
										style={styles.selectedNumeral}
										variant='display'
									>
										{number}
									</Typography>
								</View>
								<View style={styles.selectedText}>
									<CaptionText weight='semibold'>{t('cuzOrdinal', { n: number })}</CaptionText>
									<CaptionText color={theme.colors.subtext} style={styles.selectedRange}>
										{cuzSuraRange(number, language)}
									</CaptionText>
								</View>
								{/* Dropping one from the list, without hunting for it on the map. */}
								<Pressable
									accessibilityLabel={t('remove')}
									accessibilityRole='button'
									hitSlop={8}
									onPress={() => handleToggle(number)}
									style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.5 : 1 }]}
								>
									<Icon color={theme.colors.faintText} name='close' size={15} strokeWidth={2} />
								</Pressable>
							</View>
						))}
					</CardSurface>
				) : null}
			</View>

			<View style={styles.footer}>
				{/* The count is in the label, so the button says what is about to happen rather
				    than merely that something will. Disabled until there is one. */}
				<AppButton
					disabled={selected.length === 0}
					isLoading={join.isPending || pickRound.isPending}
					onPress={handleJoin}
					title={
						selected.length === 0
							? t('qPickACuz')
							: t(isRoundPick ? 'qPickWithCount' : 'qJoinWithCount', { count: selected.length })
					}
				/>
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	footer: {
		gap: 10,
		marginTop: 22
	},
	mapCard: {
		padding: 16
	},
	pickHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	remove: {
		padding: 6
	},
	selectedCard: {
		marginTop: 12
	},
	selectedNumber: {
		alignItems: 'center',
		borderRadius: 10,
		height: 34,
		justifyContent: 'center',
		width: 34
	},
	selectedNumeral: {
		fontSize: 15,
		lineHeight: 19
	},
	selectedRange: {
		marginTop: 2
	},
	selectedRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 12
	},
	selectedText: {
		flex: 1,
		minWidth: 0
	}
});
