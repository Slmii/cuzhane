import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { CaptionText, EyebrowText, MonoText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { formatInviteCode, liveLink } from '@/lib/utils/inviteCode';
import { formatLivePlace } from '@/screens/Live/liveFormat';
import type { useFreeReaderLive } from '@/screens/Live/useFreeReaderLive';
import { LiveVoiceRow } from '@/screens/Live/LiveVoiceRow.component';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, View } from 'react-native';

type Props = { live: ReturnType<typeof useFreeReaderLive> };

/** The intro's three points (A2): what following is, how people join, what it doesn't do. */
const POINTS: { icon: IconName; key: StringKey }[] = [
	{ icon: 'bookPages', key: 'livePoint1' },
	{ icon: 'share', key: 'livePoint2' },
	{ icon: 'info', key: 'livePoint3' }
];

/** Past this the list scrolls inside the sheet — a session can hold many people. */
const PEOPLE_MAX_HEIGHT = 300;

/**
 * "Birlikte oku" (lanes A, B, D and E) — one sheet for every side of a live reading:
 *
 * - **Not started** (A2–A4): what it is, then Başlat; a failed start says so in the sheet and the
 *   button becomes "Tekrar dene".
 * - **The reader's** (B1–B2): the code, large and in fours, to read aloud or send; who is reading
 *   along; and ending it, which ends it for everyone.
 * - **A follower's** (D3): who is reading and where, who else is here, and leaving.
 * - **Ended** (E4).
 *
 * Names wrap rather than cut — they are people's names, and long ones are common — and the list
 * scrolls past `PEOPLE_MAX_HEIGHT`.
 */
export const LiveSheet = ({ live }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [isCopied, setIsCopied] = useState(false);
	const { code, state } = live;
	const leader = state.people.find(person => person.isLeader);
	const followers = state.people.filter(person => !person.isLeader);

	const handleCopy = async () => {
		if (!code) {
			return;
		}

		await Clipboard.setStringAsync(code);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 1500);
	};

	const handleSend = async () => {
		if (!code) {
			return;
		}

		await Share.share({ message: t('liveShareMessage', { code: formatInviteCode(code), link: liveLink(code) }) });
	};

	const view =
		code === null
			? 'intro'
			: state.gone !== null
			? 'ended'
			: live.isLeader
			? 'share'
			: live.isFollower
			? 'follower'
			: 'intro';

	const title =
		view === 'follower'
			? t('liveIsReading', { name: leader?.name ?? t('anonymousMember') })
			: view === 'ended'
			? t('liveEndedTitle')
			: t('liveTitle');

	const people = (
		<View>
			<EyebrowText color={theme.colors.faintText} style={styles.peopleHead}>
				{t('livePeople', { count: state.people.length })}
			</EyebrowText>
			{/* Windowed: a session can hold hundreds, and a map drew every one of them at once. */}
			<FlatList
				data={state.people}
				initialNumToRender={8}
				keyExtractor={(_person, index) => String(index)}
				ListFooterComponent={
					followers.length === 0 ? (
						<CaptionText color={toAlphaColor(theme.colors.text, 0.5)} style={styles.noOne}>
							{t('liveNoOne')}
						</CaptionText>
					) : null
				}
				nestedScrollEnabled
				renderItem={({ item: person, index }) => (
					<View
						// A line between people, none above the first — the heading is the edge there.
						style={[
							styles.person,
							index > 0 && {
								borderTopColor: theme.colors.divider,
								borderTopWidth: StyleSheet.hairlineWidth
							}
						]}
					>
						<Avatar
							name={person.name ?? t('anonymousMember')}
							size={38}
							tone={person.isLeader ? 'accent' : 'neutral'}
						/>
						<Typography style={styles.personName} weight='semibold'>
							{person.name ?? t('anonymousMember')}
						</Typography>
						<View style={styles.tags}>
							{person.isLeader ? <Chip label={t('liveTagReader')} tone='accent' /> : null}
							{person.isYou ? <Chip label={t('liveTagYou')} tone='neutral' /> : null}
						</View>
						{/* The reader sees whom their voice reaches (B4). */}
						{view === 'share' && person.isListening === true ? (
							<View style={styles.listening}>
								<Icon
									color={theme.colors.liveStripAccent}
									name='speakerOn'
									size={16}
									strokeWidth={1.6}
								/>
								<Typography
									color={theme.colors.liveStripAccent}
									style={styles.listeningLabel}
									weight='semibold'
								>
									{t('liveVoiceListeningTag')}
								</Typography>
							</View>
						) : null}
					</View>
				)}
				style={styles.peopleList}
			/>
		</View>
	);

	/** A quiet red action with a line under it — ending or leaving is not the sheet's main thing. */
	const quietAction = (label: string, note: string, onPress: () => void) => (
		<View style={styles.quiet}>
			<Pressable accessibilityRole='button' onPress={onPress} style={styles.quietButton}>
				<Typography color={theme.colors.missed} style={styles.quietLabel} weight='semibold'>
					{label}
				</Typography>
			</Pressable>
			<CaptionText color={toAlphaColor(theme.colors.text, 0.5)} style={styles.quietNote}>
				{note}
			</CaptionText>
		</View>
	);

	return (
		<AppBottomSheet isVisible={live.sheet.isVisible} onClose={live.sheet.close}>
			<View style={styles.body}>
				<View style={styles.titleRow}>
					<Typography style={styles.title} variant='header2' weight='regular'>
						{title}
					</Typography>
					{view === 'share' ? <Chip label={t('liveChip')} tone='accent' /> : null}
				</View>

				{view === 'intro' ? (
					<>
						<CaptionText color={toAlphaColor(theme.colors.text, 0.6)} style={styles.lede}>
							{t('liveIntroSub')}
						</CaptionText>
						{/* The three points as one section, on a card like every other sheet's sections. */}
						<CardSurface style={styles.points}>
							{POINTS.map(point => (
								<View key={point.key} style={styles.point}>
									<View style={[styles.pointIcon, { backgroundColor: theme.colors.accentSoft }]}>
										<Icon color={theme.colors.accent} name={point.icon} size={17} />
									</View>
									<Typography style={styles.pointText}>{t(point.key)}</Typography>
								</View>
							))}
						</CardSurface>
						{live.hasStartFailed ? (
							<View style={[styles.failPanel, { backgroundColor: theme.colors.dangerSurface }]}>
								<Typography color={theme.colors.danger} style={styles.failTitle} weight='semibold'>
									{t('liveFailTitle')}
								</Typography>
								<CaptionText color={theme.colors.danger}>{t('liveFailSub')}</CaptionText>
							</View>
						) : null}
						<AppButton
							isLoading={live.isStarting}
							onPress={live.start}
							size='lg'
							title={
								live.isStarting
									? t('liveStarting')
									: live.hasStartFailed
									? t('liveRetry')
									: t('liveStart')
							}
						/>
					</>
				) : null}

				{/*
				 * The session in cards, as the intro sets its points: the code, the voice row, then
				 * who is here and ending it (Birlikte Oku Ses, B1).
				 */}
				{view === 'share' && code ? (
					<CardSurface style={styles.section}>
						<View style={styles.codePanel}>
							<EyebrowText color={theme.colors.accent}>{t('liveCodeLabel')}</EyebrowText>
							<MonoText style={styles.code}>{formatInviteCode(code)}</MonoText>
							<CaptionText color={toAlphaColor(theme.colors.text, 0.6)} style={styles.codeHint}>
								{t('liveCodeHint')}
							</CaptionText>
						</View>
						<View style={styles.pair}>
							<AppButton
								icon={isCopied ? 'check' : 'copy'}
								onPress={handleCopy}
								style={styles.pairButton}
								title={isCopied ? t('copied') : t('liveCopy')}
								variant='surface'
							/>
							<AppButton
								icon='share'
								onPress={handleSend}
								style={styles.pairButton}
								title={t('liveSend')}
								variant='primary'
							/>
						</View>
					</CardSurface>
				) : null}
				{/* "Sesimi aç" right under the code (Birlikte Oku Ses, B1); none in a build without voice. */}
				{view === 'share' && code ? <LiveVoiceRow people={state.people} /> : null}
				{view === 'share' && code ? (
					<CardSurface style={styles.section}>
						{people}
						{quietAction(t('liveEnd'), t('liveEndNote'), live.end)}
					</CardSurface>
				) : null}

				{view === 'follower' ? (
					<>
						{state.readerPlace ? (
							<CaptionText color={toAlphaColor(theme.colors.text, 0.6)} style={styles.lede}>
								{formatLivePlace(state.readerPlace, t)}
							</CaptionText>
						) : null}
						<CardSurface style={styles.section}>
							{people}
							{quietAction(t('liveLeave'), t('liveLeaveNote'), live.leave)}
						</CardSurface>
					</>
				) : null}

				{view === 'ended' ? (
					<>
						<CaptionText color={toAlphaColor(theme.colors.text, 0.6)} style={styles.lede}>
							{t('liveEndedSub')}
						</CaptionText>
						<AppButton onPress={live.leave} size='lg' title={t('close')} />
					</>
				) : null}
			</View>
		</AppBottomSheet>
	);
};

/* The design's measures (Birlikte oku, the sheets). */
const styles = StyleSheet.create({
	// No padding of its own: `AppBottomSheet` already pads its content, and doubling it made this
	// sheet narrower than every other.
	body: {
		gap: 16
	},
	code: {
		fontSize: 36,
		letterSpacing: 2.9,
		lineHeight: 40
	},
	codeHint: {
		fontSize: 12.5,
		lineHeight: 18,
		textAlign: 'center'
	},
	// The card pads the section; this only centres the code and spaces its three lines.
	codePanel: {
		alignItems: 'center',
		gap: 8
	},
	failPanel: {
		borderRadius: 14,
		gap: 4,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	failTitle: {
		fontSize: 13.5
	},
	lede: {
		fontSize: 13.5,
		lineHeight: 21,
		marginTop: -8
	},
	listening: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 5
	},
	listeningLabel: {
		fontSize: 12
	},
	noOne: {
		fontSize: 13,
		lineHeight: 19,
		paddingVertical: 12
	},
	pair: {
		flexDirection: 'row',
		gap: 8
	},
	pairButton: {
		flex: 1
	},
	peopleHead: {
		marginBottom: 4
	},
	peopleList: {
		maxHeight: PEOPLE_MAX_HEIGHT
	},
	person: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingVertical: 10
	},
	personName: {
		flex: 1,
		fontSize: 14,
		lineHeight: 19
	},
	// The icon centred on its text, whether that runs to one line or two.
	point: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12
	},
	pointIcon: {
		alignItems: 'center',
		borderRadius: 12,
		height: 34,
		justifyContent: 'center',
		width: 34
	},
	points: {
		gap: 14
	},
	pointText: {
		flex: 1,
		fontSize: 13.5,
		lineHeight: 20
	},
	quiet: {
		alignItems: 'center',
		gap: 2
	},
	quietButton: {
		padding: 10
	},
	quietLabel: {
		fontSize: 13.5
	},
	quietNote: {
		fontSize: 11.5,
		lineHeight: 17,
		textAlign: 'center'
	},
	section: {
		gap: 16
	},
	tags: {
		flexDirection: 'row',
		gap: 5
	},
	title: {
		flexShrink: 1
	},
	titleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 9
	}
});
