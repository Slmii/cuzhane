import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText, FieldLabelText, MonoText } from '@/components/ui/Typography/Typography.component';
import { cuzByNumber, cuzSuraRange } from '@/lib/content/cuz';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useRequireRoundCuz } from '@/lib/hooks/useHatimRoundGate';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CUZ_COUNT } from '@/lib/utils/units';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { CuzDetailSkeleton } from './CuzDetailSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'CuzDetail'>;

/** The frame's 52pt ring with a 40pt disc inside it. */
const RING_SIZE = 52;
const DISC_SIZE = 40;
/** The frame's 30pt column for the sura number. */
const SURA_NUMBER_WIDTH = 30;

/**
 * "Tur 3 · bugün 21:30" — when the cüz was read, as the frame states it.
 *
 * The day is compared on the device's calendar, not by subtracting hours: a read at 23:50
 * and a glance at 00:10 are one day apart however few minutes lie between them.
 */
const formatReadAt = (iso: string, locale: string, todayLabel: (time: string) => string): string => {
	const readAt = new Date(iso);
	const now = new Date();
	const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(readAt);
	const isToday =
		readAt.getFullYear() === now.getFullYear() &&
		readAt.getMonth() === now.getMonth() &&
		readAt.getDate() === now.getDate();

	return isToday
		? todayLabel(time)
		: `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(readAt)} ${time}`;
};

/**
 * Q4 — one cüz of a hatim: whether it is read, what span of the Kuran it is, and the suras
 * in it. Pushed from the cüz's row on the group screen.
 *
 * **Tracking, with the reader optional.** The frame's own subtitle says it: this page is
 * where a cüz is marked, and reading it in the app is one way of several — a mushaf or
 * another app is just as good, which is what the note at the bottom says.
 *
 * "Uygulamada oku" opens Q5, the cüz reader. "Devret" (hand a cüz to somebody) is removed
 * for now on request; it has no server path.
 */
export const CuzDetailScreen = ({ navigation, route }: Props) => {
	const { cuzNumber, groupId } = route.params;
	// Holding no cüz this round means QR1 comes first, however this screen was reached.
	useRequireRoundCuz(groupId, navigation);
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	const group = useGetGroupById(groupId);
	const babs = useGetBabs(groupId);
	const setBabRead = useSetBabRead();
	const pullToRefresh = usePullToRefresh(group, babs);

	// Bundled rather than fetched, so the heading's span and the contents' length are known
	// before either query answers.
	const entry = cuzByNumber(cuzNumber);
	const subtitle = `${cuzSuraRange(cuzNumber, language)} · ${entry?.pageCount ?? 0} ${t('qPages')}`;

	if (group.isLoading || babs.isLoading) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				<ScreenHeader
					eyebrow={t('qCuzOf', { n: cuzNumber, total: CUZ_COUNT })}
					hasBackButton
					subtitle={subtitle}
					title={t('cuzOrdinal', { n: cuzNumber })}
				/>
				<CuzDetailSkeleton suraCount={entry?.suras.length ?? 0} />
			</ScreenContainer>
		);
	}

	if (group.isError || !group.data || babs.isError || !babs.data) {
		return <ErrorState queries={[group, babs]} />;
	}

	const detail = group.data;
	const bab = babs.data.find(candidate => candidate.number === cuzNumber);
	const isRead = bab?.readAt != null;
	// Whether it is yours to mark this round — the cüz you joined with or one you borrowed
	// from the havuz. The server holds the same rule, so a stale answer here is refused
	// there rather than trusted.
	const isMine = detail.myBabNumbers.includes(cuzNumber);
	const isReadByOthers = isRead && !isMine;

	const handleToggle = () => {
		setBabRead.mutate({ babNumber: cuzNumber, groupId, read: !isRead });
	};

	const statusSub = isRead
		? t('qCuzDoneSub', {
				// Stored from zero; every screen counts from one.
				round: (detail.roundIndex ?? 0) + 1,
				when: bab?.readAt ? formatReadAt(bab.readAt, language, time => t('qTodayAt', { time })) : ''
		  })
		: t('qCuzTodoSub');

	return (
		<ScreenContainer pullToRefresh={pullToRefresh} shouldIncludeTabBarOffset>
			<ScreenHeader
				eyebrow={t('qCuzOf', { n: cuzNumber, total: CUZ_COUNT })}
				hasBackButton
				subtitle={subtitle}
				title={t('cuzOrdinal', { n: cuzNumber })}
				// "senin" beside the title, as the frame sets it — only on a cüz that is yours.
				titleTrailing={isMine ? <Chip label={t('qMine')} tone='accent' /> : null}
			/>

			{/* The state, and the one action that changes it. */}
			<CardSurface style={styles.statusCard}>
				<View style={styles.statusRow}>
					<View
						style={[
							styles.ring,
							{ backgroundColor: isRead ? theme.colors.accentSoft : theme.colors.segmentTrack }
						]}
					>
						<View style={[styles.disc, { backgroundColor: theme.colors.surface }]}>
							<Icon
								color={theme.colors.accent}
								name={isRead ? 'check' : 'book'}
								size={20}
								strokeWidth={2.2}
							/>
						</View>
					</View>
					<View style={styles.statusText}>
						<BodyStrongText>{t(isRead ? 'qCuzDone' : 'qCuzTodo')}</BodyStrongText>
						<CaptionText color={theme.colors.subtext} style={styles.statusSub}>
							{isReadByOthers
								? bab?.readByDisplayName
									? t('readBeforeYoursBy', { name: bab.readByDisplayName })
									: t('readBeforeYours')
								: statusSub}
						</CaptionText>
					</View>
				</View>
				{/*
				 * Only the holder marks it, and only the reader undoes it — the same two rules
				 * the group screen's row follows. For anyone else the state above is the whole
				 * of what this card says.
				 */}
				{isMine ? (
					<AppButton
						isLoading={setBabRead.isPending}
						onPress={handleToggle}
						title={t(isRead ? 'markUnread' : 'markRead')}
						variant={isRead ? 'surface' : 'primary'}
					/>
				) : null}
			</CardSurface>

			{/*
			 * The frame's second row, down to its first half: read it here (Q5). Its "Devret" is
			 * removed for now — what handing a cüz over *means* (back to the havuz, or to a named
			 * member) is undecided, and neither has a server path.
			 */}
			<AppButton
				icon='readInApp'
				onPress={() => navigation.push('CuzReader', { cuzNumber, groupId })}
				style={styles.action}
				title={t('qReadInApp')}
				variant='accent'
			/>

			{/* Which suras, and how much of each — the metadata the app bundles for this. */}
			<FieldLabelText style={styles.contentsLabel}>{t('qCuzContents')}</FieldLabelText>
			<CardSurface isFlush>
				{(entry?.suras ?? []).map((sura, index, suras) => (
					<View
						key={sura.chapterId}
						style={[
							styles.suraRow,
							index < suras.length - 1
								? {
										borderBottomColor: theme.colors.divider,
										borderBottomWidth: StyleSheet.hairlineWidth
								  }
								: null
						]}
					>
						<MonoText color={theme.colors.faintText} style={styles.suraNumber}>
							{sura.chapterId}
						</MonoText>
						<BodyStrongText style={styles.suraName}>{sura.name[language]}</BodyStrongText>
						<CaptionText color={theme.colors.subtext}>{`${sura.firstAyah} – ${sura.lastAyah}`}</CaptionText>
					</View>
				))}
			</CardSurface>
			<CaptionText color={theme.colors.faintText}>{t('qTrackNote')}</CaptionText>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	contentsLabel: {
		marginTop: 20
	},
	disc: {
		alignItems: 'center',
		borderRadius: DISC_SIZE / 2,
		height: DISC_SIZE,
		justifyContent: 'center',
		width: DISC_SIZE
	},
	// The frame's secondary action, 10pt under the status card.
	action: {
		marginTop: 10
	},
	ring: {
		alignItems: 'center',
		borderRadius: RING_SIZE / 2,
		height: RING_SIZE,
		justifyContent: 'center',
		width: RING_SIZE
	},
	statusCard: {
		gap: 14,
		paddingHorizontal: 16,
		paddingVertical: 18
	},
	statusRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	statusSub: {
		marginTop: 2
	},
	statusText: {
		flex: 1,
		minWidth: 0
	},
	suraName: {
		flex: 1
	},
	suraNumber: {
		width: SURA_NUMBER_WIDTH
	},
	suraRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 12
	}
});
