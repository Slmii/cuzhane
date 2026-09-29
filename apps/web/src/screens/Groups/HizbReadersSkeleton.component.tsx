import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeaderSkeleton } from '@/components/Skeleton/ScreenHeaderSkeleton.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonGhost } from '@/components/Skeleton/SkeletonGhost.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SearchBox } from '@/components/ui/SearchBox/SearchBox.component';
import { SearchInput } from '@/components/ui/SearchInput/SearchInput.component';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Platform, StyleSheet, View } from 'react-native';

/** Enough rows to fill the screen under the controls. */
const ROW_COUNT = 8;
/** `SearchBox`'s pill on iOS; the flat box's 12 on Android. */
const SEARCH_RADIUS = Platform.OS === 'ios' ? 26 : 12;
/** The drawn segmented control's track (`radius.sm + 2`). */
const FILTER_RADIUS = 10;

const noop = () => undefined;

type HizbReadersSkeletonProps = {
	/** From the group, when it is already cached — the note is then the real one. */
	hideMemberNames?: boolean;
	isOwner?: boolean;
	seesReaders?: boolean;
	/** A past day's heading (its date); today's readers by default. */
	title?: string;
};

/**
 * T5 · Bugün okuyanlar yükleniyor — `HizbReadersScreen` before its data: the same container and
 * list padding, its heading (the subtitle's counts are the data's, so a bone), the hidden-names
 * note when the cached group says so, then the search field and the filters — drawn for real but
 * hidden, each under a bone, so they take the platform's own height — and the one card of rows:
 * an avatar, a name over its plan line, and the status chip.
 *
 * The "not readers" note is left out: it appears only when someone in the group has no plan.
 */
export const HizbReadersSkeleton = ({
	hideMemberNames = false,
	isOwner = false,
	seesReaders = false,
	title
}: HizbReadersSkeletonProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<View style={styles.listContent}>
				<ScreenHeaderSkeleton hasBackButton subtitleWidth='80%' title={title ?? t('hpReadersTitle')} />
				{hideMemberNames ? (
					<View style={[styles.hiddenNote, { backgroundColor: theme.colors.sand }]}>
						<Icon color={theme.colors.sandText} name='lock' size={16} strokeWidth={1.8} />
						<CaptionText color={theme.colors.sandText} style={styles.hiddenNoteText}>
							{t(
								isOwner
									? 'hpNamesHiddenOwner'
									: seesReaders
									? 'hpNamesHiddenSeer'
									: 'hpNamesHiddenMember'
							)}
						</CaptionText>
					</View>
				) : null}
				<SkeletonPulse>
					<SkeletonGhost radius={SEARCH_RADIUS} style={styles.search}>
						{Platform.OS === 'ios' ? (
							<SearchBox onChangeText={noop} onClear={noop} placeholder={t('hpReadersSearch')} value='' />
						) : (
							<View style={styles.searchBox}>
								<Icon color={theme.colors.faintText} name='search' size={15} strokeWidth={1.8} />
								<SearchInput
									fontSize={12.5}
									onChangeText={noop}
									placeholder={t('hpReadersSearch')}
									style={styles.searchInput}
									value=''
								/>
							</View>
						)}
					</SkeletonGhost>
					<SkeletonGhost radius={FILTER_RADIUS} style={styles.filters}>
						<SegmentedControl
							onChange={noop}
							options={[
								{ label: t('hpFilterAll', { count: 0 }), value: 'all' },
								{ label: t('hpFilterDone', { count: 0 }), value: 'done' },
								{ label: t('hpFilterWaiting', { count: 0 }), value: 'waiting' }
							]}
							value='all'
						/>
					</SkeletonGhost>
					{Array.from({ length: ROW_COUNT }, (_, index) => (
						<View
							key={index}
							style={[
								styles.row,
								{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
								index === 0
									? [styles.rowFirst, { borderTopColor: theme.colors.border }]
									: { borderTopColor: theme.colors.divider },
								index === ROW_COUNT - 1 ? styles.rowLast : null
							]}
						>
							<Bone height={32} radius={16} width={32} />
							<View style={styles.copy}>
								<Bone height={9} radius={4.5} style={styles.name} width='44%' />
								<Bone height={8} radius={4} style={styles.line} tone='soft' width='78%' />
							</View>
							<Bone height={27} radius={7} tone='soft' width={64} />
						</View>
					))}
				</SkeletonPulse>
				<SkeletonStatusRow label={t('loadingMembers')} />
			</View>
		</ScreenContainer>
	);
};

/* `HizbReadersScreen`'s own measures, each bone centred in the line it stands in for. */
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
	copy: { flex: 1, minWidth: 0 },
	// 17pt line.
	name: { marginVertical: 4 },
	// 1 above a 17pt line.
	line: { marginBottom: 4.5, marginTop: 5.5 }
});
