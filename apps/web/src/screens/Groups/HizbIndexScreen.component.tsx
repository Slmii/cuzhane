import { HizbWorkCard } from '@/components/HizbWorkCard/HizbWorkCard.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { HIZB_PORTION_COUNT, HIZB_WORKS, type HizbWorkKey, workOf } from '@/lib/content/hizbPortions';
import { useGetBabs } from '@/lib/hooks/useBab';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { hizbIndexWorks } from '@/lib/utils/hizbIndex';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HizbIndexSkeleton } from './HizbIndexSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbIndex'>;

/**
 * HZ2 — the Fihrist: every portion of a Hizb group, work by work, with who is holding each one
 * this round and whether it has been read. Reached from the board's "Fihrist ›" on the group
 * screen; a row opens the reader on that portion.
 *
 * One card open at a time. It opens on the work holding the portion the viewer is on, which is
 * what HZ2 shows open and what somebody arriving here is most likely looking for; once they
 * tap a card, their choice stands.
 *
 * Everything on it is derived from the two queries the group screen already holds —
 * `hizbIndexWorks` does the work — so arriving from there is instant and there is nothing of
 * this screen's own to keep in step.
 */
export const HizbIndexScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { t } = useTranslation();
	const groupQuery = useGetGroupById(groupId);
	const babsQuery = useGetBabs(groupId);
	const pullToRefresh = usePullToRefresh(groupQuery, babsQuery);
	/** Undefined until the reader taps a card — the default below stands until then. */
	const [chosenWorkKey, setChosenWorkKey] = useState<HizbWorkKey | null | undefined>(undefined);

	// Above the early returns, reading the query data, so hook order holds across the branches.
	const group = groupQuery.data;
	const babs = babsQuery.data;
	const works = useMemo(() => (group && babs ? hizbIndexWorks(babs, group) : null), [babs, group]);
	const currentPart = group?.myNextBabNumber ?? group?.myBabNumbers[0];
	// Guarded on the book: `workOf` throws for a number the Hizb doesn't have.
	const defaultWorkKey =
		group?.kind === 'HIZB' && currentPart !== undefined && currentPart <= HIZB_PORTION_COUNT
			? workOf(currentPart).key
			: null;
	const openWorkKey = chosenWorkKey === undefined ? defaultWorkKey : chosenWorkKey;

	// Stable, because the cards are memoised on them: opening one should re-render two cards, not ten.
	const handleToggle = useCallback(
		(key: HizbWorkKey) =>
			setChosenWorkKey(current => ((current === undefined ? defaultWorkKey : current) === key ? null : key)),
		[defaultWorkKey]
	);
	const handleOpenPart = useCallback(
		(partNumber: number) => navigation.navigate('HizbReader', { groupId, partNumber }),
		[groupId, navigation]
	);

	const header = (subtitle?: string) => (
		<ScreenHeader
			eyebrow={t('kindHizb')}
			hasBackButton
			title={t('hizbIndexLink')}
			{...(subtitle === undefined ? {} : { subtitle })}
		/>
	);

	if (groupQuery.isPending || babsQuery.isPending) {
		return (
			<ScreenContainer>
				{header()}
				<HizbIndexSkeleton />
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || babsQuery.isError || !group || !works) {
		return <ErrorState queries={[groupQuery, babsQuery]} />;
	}

	return (
		<ScreenContainer pullToRefresh={pullToRefresh}>
			{header(
				t('hizbIndexSub', {
					parts: group.partCount,
					round: (group.roundIndex ?? 0) + 1,
					works: HIZB_WORKS.length
				})
			)}
			<View style={styles.cards}>
				{works.map(entry => (
					<HizbWorkCard
						entry={entry}
						isOpen={entry.work.key === openWorkKey}
						key={entry.work.key}
						onOpenPart={handleOpenPart}
						onToggle={handleToggle}
					/>
				))}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// HZ2's gap between cards — tighter than the column's own, since these are one list.
	cards: {
		gap: 9
	}
});
