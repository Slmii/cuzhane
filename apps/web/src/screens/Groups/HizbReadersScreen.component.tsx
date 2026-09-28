import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { SearchBox } from '@/components/ui/SearchBox/SearchBox.component';
import { SearchInput } from '@/components/ui/SearchInput/SearchInput.component';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import type { HizbReadingState } from '@/api/hizbReading.api';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useHizbReading } from '@/lib/hooks/useHizbReading';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { HizbReadersSkeleton } from './HizbReadersSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbReaders'>;
type Filter = 'all' | 'done' | 'waiting';
type Reader = HizbReadingState['members'][number];

/**
 * T5 of "Hizb Kişisel Plan" — today's readers: everyone with a plan (members who haven't chosen one,
 * or were taken out of the order, aren't readers and aren't listed — the note says how many). The
 * viewer is pinned first whatever the filter. A row says the reader's plan day and which of the 33
 * it covers, so different plans compare by text rather than by number. Search matches a name or a
 * portion number.
 *
 * **A windowed list**: a group has no member limit, so the readers can run to hundreds. The header,
 * the search and the filters travel as its `ListHeaderComponent`, and the rows draw one card
 * between them — the first carries the top corners, the last the bottom ones.
 */
export const HizbReadersScreen = ({ route }: Props) => {
	const { groupId } = route.params;
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const text = useHizbPlanText();
	const group = useGetGroupById(groupId);
	const query = useHizbReading(groupId);
	const pullToRefresh = usePullToRefresh(query, group);
	const [search, setSearch] = useState('');
	const [filter, setFilter] = useState<Filter>('all');
	const readers = useMemo(() => query.data?.pages[0]?.members ?? [], [query.data]);

	// You first, and always there, whatever the filter or the search.
	const list = useMemo(() => {
		const needle = search.trim().toLocaleLowerCase(language);
		const matches = (reader: Reader) => {
			if (needle === '') {
				return true;
			}

			const name = (reader.displayName ?? t('hpAnonymousReader')).toLocaleLowerCase(language);

			return name.includes(needle) || text.portionsOf(reader).some(number => String(number) === needle);
		};
		const inFilter = (reader: Reader) =>
			filter === 'all' || (filter === 'done' ? reader.completed : !reader.completed);

		return [
			...readers.filter(reader => reader.isMe),
			...readers.filter(reader => !reader.isMe && inFilter(reader) && matches(reader))
		];
	}, [filter, language, readers, search, t, text]);

	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}

	if (!query.data) {
		return (
			<HizbReadersSkeleton
				hideMemberNames={group.data?.hideMemberNames ?? false}
				isOwner={group.data?.isOwner ?? false}
			/>
		);
	}

	const doneCount = readers.filter(reader => reader.completed).length;
	const memberCount = group.data?.memberCount ?? readers.length;
	const notReaders = Math.max(0, memberCount - readers.length);

	const tones = [
		[theme.colors.accentSoft, theme.colors.accent],
		[theme.colors.sand, theme.colors.sandText],
		[theme.colors.missedSurface, theme.colors.missed]
	] as const;

	const status = (reader: Reader) =>
		reader.completed
			? { background: theme.colors.accentSoft, foreground: theme.colors.accent, label: t('hpStatusDone') }
			: reader.started
			? { background: theme.colors.sand, foreground: theme.colors.sandText, label: t('hpStatusStarted') }
			: {
					background: theme.colors.segmentTrack,
					foreground: theme.colors.faintText,
					label: t('hpStatusWaiting')
			  };

	const header = (
		<View>
			<ScreenHeader
				hasBackButton
				subtitle={t('hpReadersSubtitle', { members: memberCount, read: doneCount, readers: readers.length })}
				title={t('hpReadersTitle')}
			/>
			{/* S4: names hidden — members are told, and the creator is reminded their list shows names. */}
			{group.data?.hideMemberNames ? (
				<View style={[styles.hiddenNote, { backgroundColor: theme.colors.sand }]}>
					<Icon color={theme.colors.sandText} name='lock' size={16} strokeWidth={1.8} />
					<CaptionText color={theme.colors.sandText} style={styles.hiddenNoteText}>
						{t(group.data.isOwner ? 'hpNamesHiddenOwner' : 'hpNamesHiddenMember')}
					</CaptionText>
				</View>
			) : null}
			{/* iOS: the glass pill every search box there is; Android keeps the frame's flat box. */}
			{Platform.OS === 'ios' ? (
				<SearchBox
					onChangeText={setSearch}
					onClear={() => setSearch('')}
					placeholder={t('hpReadersSearch')}
					style={styles.search}
					value={search}
				/>
			) : (
				<View
					style={[
						styles.search,
						styles.searchBox,
						{ backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }
					]}
				>
					<Icon color={theme.colors.faintText} name='search' size={15} strokeWidth={1.8} />
					<SearchInput
						fontSize={12.5}
						onChangeText={setSearch}
						placeholder={t('hpReadersSearch')}
						style={styles.searchInput}
						value={search}
					/>
				</View>
			)}
			<SegmentedControl
				onChange={value => setFilter(value as Filter)}
				options={[
					{ label: t('hpFilterAll', { count: readers.length }), value: 'all' },
					{ label: t('hpFilterDone', { count: doneCount }), value: 'done' },
					{ label: t('hpFilterWaiting', { count: readers.length - doneCount }), value: 'waiting' }
				]}
				style={styles.filters}
				value={filter}
			/>
			{notReaders > 0 ? (
				<CaptionText color={theme.colors.faintText} style={styles.note}>
					{t('hpReadersNote', { count: notReaders })}
				</CaptionText>
			) : null}
		</View>
	);

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<PullToRefresh {...pullToRefresh}>
				<FlatList
					contentContainerStyle={styles.listContent}
					data={list}
					initialNumToRender={14}
					keyboardShouldPersistTaps='handled'
					keyExtractor={reader => reader.id}
					ListHeaderComponent={header}
					maxToRenderPerBatch={14}
					nestedScrollEnabled
					renderItem={({ index, item: reader }) => {
						const [background, foreground] = reader.isMe
							? [theme.colors.primary, theme.colors.onPrimary]
							: reader.displayName === null
							? [theme.colors.segmentTrack, theme.colors.faintText]
							: tones[index % tones.length] ?? tones[0];
						const isAnonymous = !reader.isMe && reader.displayName === null;
						const name = reader.isMe ? t('hpYou') : reader.displayName ?? t('hpAnonymousReader');
						const chip = status(reader);

						return (
							<View
								style={[
									styles.row,
									{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
									index === 0
										? [styles.rowFirst, { borderTopColor: theme.colors.border }]
										: { borderTopColor: theme.colors.divider },
									index === list.length - 1 ? styles.rowLast : null
								]}
							>
								<View style={[styles.avatar, { backgroundColor: background }]}>
									{/* A hidden name has no initial to show either. */}
									{isAnonymous ? (
										<Icon color={theme.colors.faintText} name='lock' size={13} strokeWidth={1.8} />
									) : (
										<CaptionText color={foreground} style={styles.avatarLabel} weight='semibold'>
											{name.charAt(0).toLocaleUpperCase(language)}
										</CaptionText>
									)}
								</View>
								<View style={styles.copy}>
									<CaptionText
										color={
											reader.displayName === null && !reader.isMe
												? theme.colors.subtext
												: theme.colors.text
										}
										style={styles.name}
										weight='semibold'
									>
										{name}
									</CaptionText>
									<CaptionText color={theme.colors.faintText} style={styles.line}>
										{t('hpReaderLine', {
											plan: t('hpPlanDay', { day: reader.portion, days: reader.planDays }),
											portions: text.portionsLabel(reader)
										})}
									</CaptionText>
								</View>
								<View style={[styles.chip, { backgroundColor: chip.background }]}>
									<CaptionText color={chip.foreground} style={styles.chipLabel} weight='semibold'>
										{chip.label}
									</CaptionText>
								</View>
							</View>
						);
					}}
					showsVerticalScrollIndicator={false}
					windowSize={9}
				/>
			</PullToRefresh>
		</ScreenContainer>
	);
};

/* The design's measures, one to one (T5 of "Hizb Kişisel Plan"). */
const styles = StyleSheet.create({
	flush: { paddingHorizontal: 0 },
	listContent: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 8 },
	hiddenNote: {
		alignItems: 'center',
		borderRadius: 14,
		flexDirection: 'row',
		gap: 10,
		marginTop: 12,
		paddingHorizontal: 14,
		paddingVertical: 11
	},
	hiddenNoteText: { flex: 1, fontSize: 11.5, lineHeight: 16.7 },
	search: { marginBottom: 10, marginTop: 12 },
	searchBox: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 13,
		paddingVertical: 11
	},
	searchInput: { flex: 1 },
	filters: { marginBottom: 12 },
	note: { fontSize: 11, lineHeight: 16.5, marginBottom: 10, marginHorizontal: 2, marginTop: -4 },
	row: {
		alignItems: 'center',
		borderLeftWidth: StyleSheet.hairlineWidth,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 11
	},
	rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
	rowLast: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: StyleSheet.hairlineWidth },
	avatar: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
	avatarLabel: { fontSize: 12 },
	copy: { flex: 1, minWidth: 0 },
	name: { fontSize: 12.5 },
	line: { fontSize: 11, marginTop: 1 },
	chip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
	chipLabel: { fontSize: 10.5 }
});
