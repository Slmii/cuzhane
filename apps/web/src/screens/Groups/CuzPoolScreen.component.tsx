import { CuzMap, CuzMapLegend } from '@/components/CuzMap/CuzMap.component';
import type { CuzCellState } from '@/components/CuzMap/CuzMap.types';
import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { BodyStrongText, CaptionText, NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { cuzSuraRange } from '@/lib/content/cuz';
import { useGetPoolCuz, useReleasePoolCuz, useTakePoolCuz } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useViewerIdentity } from '@/lib/hooks/useViewerIdentity';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { PoolCuz } from '@/lib/types/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** The design's 44pt badge, as on the Cevşen pool's range. */
const BADGE_SIZE = 44;
/** The design's 31pt owner mark on a taken row. */
const AVATAR_SIZE = 31;
/** A middling guess at the pool's size, so the card lands near its final height. */
const SKELETON_CELL_COUNT = 15;

/**
 * **Q3 — the hatim's havuz.** The Cevşen pool screen, one unit apart.
 *
 * What is shared is the shape: a count and a board at the top, then a row per thing on offer
 * with Üstlen beside it and Geri al where you have taken one. What differs is what a row *is*
 * — a Cevşen slot is an empty seat's block, taken whole, and a hatim has no seats that mean
 * anything, so here a row is one cüz.
 *
 * **Taking one is a loan.** It covers this round and goes back to the havuz at the boundary
 * whatever the group's "Tur bitiminde" says — the same promise a Cevşen claim makes, and the
 * reason the sub-line says so rather than leaving it to be discovered at the rollover.
 */
export const CuzPoolScreen = ({ groupId }: { groupId: string }) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const pool = useGetPoolCuz(groupId);
	// Your own name and photo: a row you just took can draw your avatar before the server
	// echoes the name back, and it draws the picture you actually set rather than a generated
	// face — see `useViewerIdentity`.
	const viewer = useViewerIdentity();
	const takeCuz = useTakePoolCuz();
	const releaseCuz = useReleasePoolCuz();
	const pullToRefresh = usePullToRefresh(pool);

	/**
	 * Cüz taken on this visit — the ones whose sub-line reads "az önce üstlendin".
	 *
	 * Deliberately memory rather than a stored timestamp, exactly as the Cevşen screen has it:
	 * the claim is about the tap you just made. It does **not** decide whether the button
	 * appears — that follows from holding the cüz, so a reload cannot take away your way back.
	 */
	const [takenHere, setTakenHere] = useState<number[]>([]);

	const handleTake = (cuzNumber: number) => {
		setTakenHere(current => (current.includes(cuzNumber) ? current : [...current, cuzNumber]));
		takeCuz.mutate({ cuzNumber, groupId });
	};

	const handleUndo = (cuzNumber: number) => {
		setTakenHere(current => current.filter(number => number !== cuzNumber));
		releaseCuz.mutate({ cuzNumber, groupId });
	};

	if (pool.isLoading) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<ScreenHeader eyebrow={t('pool')} hasBackButton subtitle={t('poolSubCuz')} title={t('poolTitleCuz')} />
				<GridSkeleton cellCount={SKELETON_CELL_COUNT} />
				<SkeletonStatusRow label={t('loadingPoolCuz')} />
			</ScreenContainer>
		);
	}

	if (pool.isError || !pool.data) {
		return <ErrorState queries={[pool]} />;
	}

	const cuz = pool.data;
	// Free only, not the whole havuz. The header answers "what can I take on right now", so a
	// cüz somebody has already borrowed is not part of the offer — it stays in the rows below,
	// where its holder is named.
	const free = cuz.filter(entry => entry.takenByUserId === null);
	const takenByNumber = new Map(cuz.map(entry => [entry.cuzNumber, entry]));

	/*
	 * The board draws all thirty, not just the havuz: a map with holes where the group's own
	 * cüz are would be a different picture from every other map in the app. A cüz that is not
	 * in this list is simply somebody's — `taken`.
	 *
	 * **Three states, not four.** This map first drew a borrowed cüz that had been read as
	 * `read`, and its legend then showed "okundu" and "senin" as the same swatch: the export
	 * gives both the deep green and tells them apart only by the ring on yours, which an
	 * eleven-point square cannot carry. Whether somebody else has finished their loan is the
	 * group board's news (Q2), not the havuz's — here the question is what is free, what is
	 * taken and what is yours, the same three the lobby and the picker answer.
	 */
	const stateOf = (cuzNumber: number): CuzCellState => {
		const entry = takenByNumber.get(cuzNumber);

		if (entry === undefined) {
			return 'taken';
		}

		if (entry.takenByMe) {
			return 'mine';
		}

		return entry.takenByUserId === null ? 'free' : 'taken';
	};

	const renderCuz = (entry: PoolCuz) => {
		const isTaken = entry.takenByUserId !== null;
		/*
		 * Two different questions, as on the Cevşen screen.
		 *
		 * *Can* you hand it back — true of any loan you hold, for as long as the round is open.
		 * *Did you just take it* — the sub-line's claim, which really is about this app run.
		 */
		const canUndo = isTaken && entry.takenByMe;
		const isJustTaken = canUndo && takenHere.includes(entry.cuzNumber);
		// A sentence, to sit beside "Ali üstlendi" — not the legend's one-word `legendMine`.
		const takerLabel = entry.takenByMe
			? t('poolTakenByYou')
			: `${entry.takenByDisplayName ?? ''} ${t('takenBy')}`.trim();
		/*
		 * Matched against the cüz actually in flight. Both mutations belong to the whole screen,
		 * so read bare they would dim every free row's button at once — a full havuz would look
		 * like you had taken all of it.
		 */
		const isPending =
			(takeCuz.isPending && takeCuz.variables?.cuzNumber === entry.cuzNumber) ||
			(releaseCuz.isPending && releaseCuz.variables?.cuzNumber === entry.cuzNumber);
		const badgeBackgroundColor = entry.takenByMe
			? theme.colors.accent
			: isTaken
			? theme.colors.poolTaken
			: theme.colors.surface;
		const badgeLabelColor = entry.takenByMe
			? theme.colors.onAccent
			: isTaken
			? theme.colors.poolTakenText
			: theme.colors.accent;

		return (
			/*
			 * The wash for a claimed row sits on what it *describes* — the number and the label —
			 * and never on the controls beside them: applied to the whole card it takes the
			 * avatar and the button down with it, and a dark green button at 62% reads as
			 * disabled, which is the opposite of what that row offers.
			 */
			<CardSurface key={entry.cuzNumber} style={styles.cuzCard}>
				{isTaken ? null : <Hatch radius={theme.radius.lg} />}
				<View
					style={[
						styles.cuzBadge,
						isTaken ? styles.claimed : null,
						{
							backgroundColor: badgeBackgroundColor,
							borderColor: isTaken ? theme.colors.transparent : theme.colors.border
						}
					]}
				>
					<Typography color={badgeLabelColor} numberOfLines={1} textAlign='center' variant='body'>
						{entry.cuzNumber}
					</Typography>
				</View>
				{/* One line each, always — the undo row carries an avatar *and* a button where the
				    free one carries only a button, so the text column is narrower there. */}
				<View style={[styles.cuzText, isTaken ? styles.claimed : null]}>
					<BodyStrongText numberOfLines={1}>{isTaken ? takerLabel : t('poolOwnerless')}</BodyStrongText>
					{/* What the cüz actually is, rather than "1 cüz" — a number says nothing about
					    what you are taking on, and the span is the whole of the answer. */}
					<CaptionText color={theme.colors.subtext} numberOfLines={1} style={styles.cuzSub}>
						{isJustTaken
							? `${cuzSuraRange(entry.cuzNumber, language)} · ${t('poolUndoHint')}`
							: isTaken
							? cuzSuraRange(entry.cuzNumber, language)
							: `${cuzSuraRange(entry.cuzNumber, language)} · ${t('poolExtraCuz')}`}
					</CaptionText>
				</View>
				{isTaken ? (
					<Avatar
						imageUrl={entry.takenByMe ? viewer.imageUrl : entry.takenByImageUrl}
						name={entry.takenByMe ? viewer.displayName : entry.takenByDisplayName ?? ''}
						size={AVATAR_SIZE}
						tone={entry.takenByMe ? 'accent' : 'sand'}
					/>
				) : null}
				{/*
				 * **One button in one place, whichever way it reads** — see the Cevşen screen for
				 * why the two share an element rather than being two branches of a ternary: a
				 * glass button is a SwiftUI host that measures itself, and a freshly mounted one
				 * spills past the card's edge before it reports its width.
				 *
				 * Nothing at all for somebody else's loan: their avatar is the whole answer.
				 */}
				{canUndo || !isTaken ? (
					<AppButton
						disabled={isPending}
						fullWidth={false}
						icon={canUndo ? 'undo' : 'claim'}
						onPress={() => (canUndo ? handleUndo(entry.cuzNumber) : handleTake(entry.cuzNumber))}
						size='sm'
						title={canUndo ? t('poolUndo') : t('poolTake')}
						variant='accent'
					/>
				) : null}
			</CardSurface>
		);
	};

	return (
		<ScreenContainer pullToRefresh={pullToRefresh} shouldIncludeTabBarOffset>
			<ScreenHeader eyebrow={t('pool')} hasBackButton subtitle={t('poolSubCuz')} title={t('poolTitleCuz')} />
			{cuz.length === 0 ? (
				<EmptyState title={t('poolNoneCuz')} />
			) : (
				<>
					<CardSurface style={styles.summaryCard}>
						<View style={styles.summaryRow}>
							<NumericText color={theme.colors.accent}>{free.length}</NumericText>
							<CaptionText color={theme.colors.faintText}>{t('poolCuz')}</CaptionText>
						</View>
						{/* Read-only: the rows below are where a cüz is taken, so a tappable board
						    would be a second control for one action. */}
						<CuzMap stateOf={stateOf} variant='compact' />
						<CuzMapLegend
							freeLabel={t('qFree')}
							mineLabel={t('legendMine')}
							states={['taken', 'free', 'mine']}
						/>
					</CardSurface>
					<View style={styles.cuzList}>{cuz.map(renderCuz)}</View>
				</>
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// Square at 44pt, as the Cevşen row's range badge is — a cüz number never needs more.
	cuzBadge: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		height: BADGE_SIZE,
		justifyContent: 'center',
		minWidth: BADGE_SIZE,
		paddingHorizontal: 6
	},
	cuzCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	cuzList: {
		gap: 9
	},
	cuzSub: {
		marginTop: 2
	},
	cuzText: {
		flex: 1,
		minWidth: 0
	},
	// The design's dimming for something no longer on offer — the number and the label only.
	claimed: {
		opacity: 0.62
	},
	summaryCard: {
		marginBottom: 12,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	summaryRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12
	}
});
