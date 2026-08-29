import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { ReaderSkeleton } from './ReaderSkeleton.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { BISMILLAH, getBab, READER_FONT_SIZES, readerFontSize } from '@/lib/content/cevsen';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useGetGroupById, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { BAB_COUNT, slotIndexForBab } from '@/lib/utils/babs';
import type { TabStackParamList } from '@/navigation/types';
import { TextSizeOption } from '@/screens/Reader/TextSizeOption.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'BabReader'>;

/** The header's progress rail — 148×5 with an 11pt head inside a 3pt ring. */
const RAIL_HEIGHT = 5;
const RAIL_DOT_SIZE = 11;
const RAIL_HEAD_SIZE = RAIL_DOT_SIZE + 6;
const RAIL_HEAD_RING_ALPHA = 0.17;

export const BabReaderScreen = ({ navigation, route }: Props) => {
	const { babNumber, groupId } = route.params;
	const { mode, theme } = useThemeContext();
	const { t } = useTranslation();

	const babsQuery = useGetBabs(groupId);
	const groupQuery = useGetGroupById(groupId);
	const takePoolSlot = useTakePoolSlot();
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const setBabRead = useSetBabRead();
	const [isTextSizeSheetOpen, setIsTextSizeSheetOpen] = useState(false);

	if (babsQuery.isPending || settingsQuery.isPending) {
		return (
			<SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
				<ReaderSkeleton />
			</SafeAreaView>
		);
	}

	if (babsQuery.isError || settingsQuery.isError) {
		return (
			<SafeAreaView style={[styles.safeArea, styles.centered, { backgroundColor: theme.colors.background }]}>
				<EmptyState
					actionLabel={t('retry')}
					onAction={() => {
						babsQuery.refetch();
						settingsQuery.refetch();
					}}
					title={t('genericError')}
				/>
			</SafeAreaView>
		);
	}

	const babs = babsQuery.data ?? [];
	// Today's share, per the server — under ROTATION it is a different seat's block each
	// day, so it can't be read off `assignedUserId`.
	const myBabNumbers = groupQuery.data?.myBabNumbers ?? [];
	// A bab from a seat nobody took. It can be read, but only after taking it.
	const isPoolBab = groupQuery.data?.poolBabNumbers.includes(babNumber) ?? false;
	const poolSlotIndex = isPoolBab && groupQuery.data ? slotIndexForBab(babNumber, groupQuery.data.spots) : null;
	const currentBab = babs.find(bab => bab.number === babNumber);
	const isRead = Boolean(currentBab?.readAt);
	const fontScale = settingsQuery.data?.readerFontScale ?? 0;
	const fontSize = readerFontSize(fontScale);
	const cevsenBab = getBab(babNumber);
	const blurTint = mode === 'dark' ? 'dark' : 'light';
	const fontSizeLabels = [t('fsSmall'), t('fsMed'), t('fsLarge')];

	/**
	 * The reader moves through *your share*, not through the hundred. Stepping by ±1 walked
	 * into babs belonging to other members — readable to look at but not to mark — and made
	 * "3 / 100" the header of a five-bab round. `readableBabNumbers` is the ordered list the
	 * arrows, the rail and the count all measure against.
	 *
	 * A pool bab is included when it is the one being read: it isn't part of the share until
	 * it's taken, but arriving on it from the pool screen and finding no rail would be worse.
	 */
	const readableBabNumbers =
		myBabNumbers.length > 0 && !myBabNumbers.includes(babNumber)
			? [...myBabNumbers, babNumber].sort((a, b) => a - b)
			: myBabNumbers;
	const currentIndex = readableBabNumbers.indexOf(babNumber);
	const readableTotal = readableBabNumbers.length;
	const readableDoneCount = readableBabNumbers.filter(number =>
		babs.some(bab => bab.number === number && bab.readAt !== null)
	).length;
	const donePercent = readableTotal === 0 ? 0 : (readableDoneCount / readableTotal) * 100;
	// Half a slice in, so the head sits on the bab rather than on the boundary before it.
	const positionPercent = readableTotal === 0 || currentIndex < 0 ? 0 : ((currentIndex + 0.5) / readableTotal) * 100;
	const previousBabNumber = currentIndex > 0 ? readableBabNumbers[currentIndex - 1] : undefined;
	const nextBabNumber = currentIndex >= 0 ? readableBabNumbers[currentIndex + 1] : undefined;

	const goToBab = (nextNumber: number | undefined) => {
		if (nextNumber === undefined) {
			return;
		}

		navigation.setParams({ babNumber: Math.max(1, Math.min(BAB_COUNT, nextNumber)) });
	};

	const handlePickFontScale = (nextScale: number) => {
		updateSettings.mutate({ readerFontScale: nextScale });
		setIsTextSizeSheetOpen(false);
	};

	const toggleCurrentRead = () => {
		setBabRead.mutate({ babNumber, groupId, read: !isRead });
	};

	// Taking the slot is what makes the bab readable — marking it read is only allowed
	// once it belongs to someone, so the two run in order rather than in parallel.
	const handleTakeAndRead = () => {
		if (poolSlotIndex === null) {
			return;
		}

		takePoolSlot.mutate(
			{ groupId, slotIndex: poolSlotIndex },
			{ onSuccess: () => setBabRead.mutate({ babNumber, groupId, read: true }) }
		);
	};

	return (
		<SafeAreaView
			edges={['top', 'bottom', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
		>
			<View style={[styles.header, { borderBottomColor: theme.colors.readerRule }]}>
				<BlurView intensity={30} style={StyleSheet.absoluteFill} tint={blurTint} />
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<View style={styles.headerTopRow}>
					<View style={styles.headerSide}>
						<BackLink onPress={navigation.goBack} />
					</View>
					<View style={styles.headerCenter}>
						{/* Your position in your own share — "Bab 3 / 5", not "Bab 87 / 100". The
						    hundred is the group's business; the reader is only ever yours. */}
						<EyebrowText>{`${t('bab')} ${currentIndex + 1} / ${readableTotal}`}</EyebrowText>
					</View>
					<View style={[styles.headerSide, styles.headerSideEnd]}>
						<Pressable
							accessibilityRole='button'
							onPress={() => setIsTextSizeSheetOpen(true)}
							style={[
								styles.fsButton,
								{
									backgroundColor: isTextSizeSheetOpen
										? theme.colors.accentSoft
										: theme.colors.surface,
									borderColor: isTextSizeSheetOpen ? theme.colors.accent : theme.colors.border
								}
							]}
						>
							<Typography
								color={isTextSizeSheetOpen ? theme.colors.accent : undefined}
								variant='bodyStrong'
							>
								Aa
							</Typography>
						</Pressable>
					</View>
				</View>
				<View style={styles.headerBottomRow}>
					<Typography variant='title' weight='regular'>
						{t('babOrdinal', { n: babNumber })}
					</Typography>
					{/*
					 * One rail, not one dash per bab. A share of five drew five fat dashes and a
					 * share of fifty drew fifty hairlines that stopped reading as anything; a
					 * proportional bar looks the same at either size. The filled part is what's
					 * read, and the dot is where you are — centred on its own slice, so the first
					 * of five sits at 10% rather than hard against the left end.
					 */}
					<View style={[styles.rail, { backgroundColor: theme.colors.switchTrackOff }]}>
						<View
							style={[
								styles.railFill,
								{ backgroundColor: theme.colors.accentMid, width: `${donePercent}%` }
							]}
						/>
						<View
							style={[
								styles.railHead,
								{
									backgroundColor: toAlphaColor(theme.colors.accent, RAIL_HEAD_RING_ALPHA),
									left: `${positionPercent}%`
								}
							]}
						>
							<View style={[styles.railDot, { backgroundColor: theme.colors.accent }]} />
						</View>
					</View>
				</View>
			</View>

			<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
				{/* Says why this bab isn't in your own range before you read a word of it. */}
				{isPoolBab ? (
					<CardSurface style={styles.poolBanner}>
						<View style={[styles.poolIcon, { backgroundColor: theme.colors.sand }]}>
							<Icon color={theme.colors.sandText} name='info' size={17} />
						</View>
						<View style={styles.poolBannerText}>
							<BodyStrongText>{t('poolBanner')}</BodyStrongText>
							<CaptionText color={theme.colors.subtext} style={styles.poolBannerSub}>
								{t('poolBannerSub')}
							</CaptionText>
						</View>
					</CardSurface>
				) : null}
				<Typography color={theme.colors.accent} style={styles.glyph} textAlign='center'>
					۞
				</Typography>
				{BISMILLAH ? (
					<Typography style={styles.bismillah} textAlign='right'>
						{BISMILLAH}
					</Typography>
				) : null}
				{cevsenBab?.arabic ? (
					<Typography
						style={[styles.arabic, { fontSize, lineHeight: fontSize * 2, writingDirection: 'rtl' }]}
						textAlign='right'
					>
						{cevsenBab.arabic}
					</Typography>
				) : (
					<Typography color={theme.colors.faintText} style={styles.missing} textAlign='center'>
						{t('readerMissing')}
					</Typography>
				)}
			</ScrollView>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<BlurView intensity={30} style={StyleSheet.absoluteFill} tint={blurTint} />
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<Pressable
					accessibilityRole='button'
					disabled={previousBabNumber === undefined}
					onPress={() => goToBab(previousBabNumber)}
					style={[
						styles.navButton,
						{
							backgroundColor: theme.colors.surface,
							borderColor: theme.colors.border,
							opacity: previousBabNumber === undefined ? 0.4 : 1
						}
					]}
				>
					<Icon name='back' size={17} />
				</Pressable>
				<Pressable
					accessibilityRole='button'
					onPress={isPoolBab ? handleTakeAndRead : toggleCurrentRead}
					style={[
						styles.markButton,
						{
							backgroundColor: isRead ? theme.colors.surface : theme.colors.accent,
							borderColor: theme.colors.accent
						}
					]}
				>
					<Typography color={isRead ? theme.colors.accent : theme.colors.onAccent} variant='bodyStrong'>
						{isPoolBab ? t('takeAndRead') : isRead ? t('markUnread') : t('markRead')}
					</Typography>
				</Pressable>
				<Pressable
					accessibilityRole='button'
					disabled={nextBabNumber === undefined}
					onPress={() => goToBab(nextBabNumber)}
					style={[
						styles.navButton,
						{
							backgroundColor: theme.colors.surface,
							borderColor: theme.colors.border,
							opacity: nextBabNumber === undefined ? 0.4 : 1
						}
					]}
				>
					<Icon name='chevron' size={17} />
				</Pressable>
			</View>

			<AppBottomSheet
				description={t('textSizeHint')}
				isVisible={isTextSizeSheetOpen}
				onClose={() => setIsTextSizeSheetOpen(false)}
				title={t('textSize')}
			>
				<View style={styles.textSizeOptions}>
					{READER_FONT_SIZES.map((sizePx, index) => (
						<TextSizeOption
							isSelected={fontScale === index}
							key={sizePx}
							label={fontSizeLabels[index]}
							onPress={() => handlePickFontScale(index)}
							sample={sizePx}
						/>
					))}
				</View>
			</AppBottomSheet>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	arabic: {
		marginBottom: 22
	},
	bismillah: {
		marginBottom: 20
	},
	body: {
		paddingHorizontal: 22,
		paddingTop: 26,
		paddingBottom: 20
	},
	centered: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	rail: {
		borderRadius: 3,
		flex: 1,
		height: RAIL_HEIGHT,
		// The head's ring overflows the rail's own height; letting it show is the point.
		marginLeft: 'auto',
		maxWidth: 148,
		position: 'relative'
	},
	railDot: {
		borderRadius: RAIL_DOT_SIZE / 2,
		height: RAIL_DOT_SIZE,
		width: RAIL_DOT_SIZE
	},
	railFill: {
		borderRadius: 3,
		bottom: 0,
		left: 0,
		position: 'absolute',
		top: 0
	},
	// The design's `box-shadow: 0 0 0 3px` — RN has no spread shadow, so the ring is a
	// wrapper three points larger on every side, tinted with the accent at low alpha.
	railHead: {
		alignItems: 'center',
		borderRadius: RAIL_HEAD_SIZE / 2,
		height: RAIL_HEAD_SIZE,
		justifyContent: 'center',
		marginLeft: -RAIL_HEAD_SIZE / 2,
		position: 'absolute',
		top: (RAIL_HEIGHT - RAIL_HEAD_SIZE) / 2,
		width: RAIL_HEAD_SIZE
	},
	footer: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 8,
		overflow: 'hidden',
		paddingBottom: 16,
		paddingHorizontal: 20,
		paddingTop: 12
	},
	fsButton: {
		alignItems: 'center',
		borderRadius: 9,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	poolBanner: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 11,
		marginBottom: 12
	},
	poolBannerSub: {
		marginTop: 2
	},
	poolBannerText: {
		flex: 1,
		minWidth: 0
	},
	poolIcon: {
		alignItems: 'center',
		borderRadius: 11,
		height: 34,
		justifyContent: 'center',
		width: 34
	},
	glyph: {
		fontSize: 15,
		marginBottom: 22
	},
	header: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		gap: 10,
		overflow: 'hidden',
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 8
	},
	headerBottomRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	headerCenter: {
		alignItems: 'center',
		flex: 1
	},
	headerSide: {
		alignItems: 'flex-start',
		flex: 1
	},
	headerSideEnd: {
		alignItems: 'flex-end'
	},
	headerTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	markButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: 1.5,
		flex: 1,
		paddingVertical: 14
	},
	missing: {
		paddingVertical: 20
	},
	navButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	safeArea: {
		flex: 1
	},
	textSizeOptions: {
		gap: 9
	}
});
