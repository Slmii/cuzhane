import { getLiveSession } from '@/api/live.api';
import { WrapperApiError } from '@/api/wrapper.api';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { LiveSessionPreview } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import { liveSession } from '@/lib/live/liveSession';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { formatLivePlace } from '@/screens/Live/liveFormat';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'LiveJoin'>;

/** Long enough to read who you are joining, short enough to feel like a step rather than a wait. */
const JOINING_BEAT_MS = 700;

/**
 * Where a live reading's code lands — from its link or from "Davet kodum var" (Birlikte oku, C2).
 * It looks the session up, shows who is reading and where for a beat, then replaces itself with
 * the reader it is read in, already following.
 *
 * **A code that finds nothing still opens a reader** (E5): the free Cevşen, on its own, with the
 * live row saying the code was not found. The person arrived wanting to read; a dead end would
 * be the one screen here that does not let them.
 *
 * Replaces only while focused: `replace` acts on the top of the stack, whatever is on it.
 */
export const LiveJoinScreen = ({ navigation, route }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isFocused = useIsFocused();
	const [session, setSession] = useState<LiveSessionPreview | null>(null);
	// A lookup that failed for any reason but "not found" — offline, rate-limited — and its retry.
	const [hasFailed, setHasFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const { code } = route.params;

	useEffect(() => {
		if (!isFocused) {
			return;
		}

		let isCancelled = false;
		let beat: ReturnType<typeof setTimeout> | null = null;

		getLiveSession(code)
			.then(found => {
				if (isCancelled) {
					return;
				}

				setSession(found);
				beat = setTimeout(() => {
					/*
					 * Joined in the app's live reading (`lib/live/liveSession`), then into its reader,
					 * which attaches to it. The same code again changes nothing; another while this
					 * person leads one would end theirs for everyone, so they are asked first.
					 */
					const proceed = () => {
						liveSession.join(found.code, found.kind);
						navigation.replace(found.kind === 'CEVSEN' ? 'AllBabs' : 'Mushaf');
					};
					const current = liveSession.getSnapshot();

					if (current && current.code !== found.code && current.role === 'leader' && current.gone === null) {
						confirmDestructive({
							cancelLabel: t('cancel'),
							confirmLabel: t('liveReplaceConfirm'),
							message: t('liveReplaceBody'),
							onCancel: () => navigation.goBack(),
							onConfirm: proceed,
							title: t('liveReplaceTitle')
						});

						return;
					}

					proceed();
				}, JOINING_BEAT_MS);
			})
			.catch(error => {
				if (isCancelled) {
					return;
				}

				/*
				 * Only a code the server does not know opens the free Cevşen on its own (E5). Any
				 * other failure says nothing about the session — a Kur'an one opened in the Cevşen
				 * would ignore every place its reader sent — so it offers another try instead.
				 */
				// The session running, if any, is left alone: a mistyped code must not end it.
				if (error instanceof WrapperApiError && error.status === 404) {
					navigation.replace('AllBabs', { liveNotFoundCode: code });
				} else {
					setHasFailed(true);
				}
			});

		return () => {
			isCancelled = true;

			if (beat) {
				clearTimeout(beat);
			}
		};
	}, [attempt, code, isFocused, navigation, t]);

	const readerName = session?.leaderName ?? t('anonymousMember');
	const place = session?.position
		? formatLivePlace(
				session.position.k === 'CEVSEN'
					? { bab: session.position.bab, k: 'CEVSEN' }
					: { cuz: session.position.cuz, k: 'QURAN', page: session.position.page },
				t
		  )
		: null;

	return (
		<SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
			{hasFailed ? null : <ActivityIndicator color={theme.colors.accent} size='large' />}
			<Typography style={styles.title} variant='header2' weight='regular'>
				{hasFailed ? t('genericError') : t('liveJoiningTitle')}
			</Typography>
			{/* Mounted from the start and shown on failure: a native button mounted on the spot draws unplaced. */}
			<View pointerEvents={hasFailed ? 'auto' : 'none'} style={{ opacity: hasFailed ? 1 : 0 }}>
				<AppButton
					disabled={!hasFailed}
					fullWidth={false}
					onPress={() => {
						setHasFailed(false);
						setAttempt(current => current + 1);
					}}
					title={t('liveRetry')}
				/>
			</View>
			{session ? (
				<CardSurface style={styles.card}>
					<Avatar name={readerName} size={40} tone='accent' />
					<View style={styles.cardCopy}>
						<Typography style={styles.cardName} weight='semibold'>
							{readerName}
						</Typography>
						{place ? (
							<CaptionText color={toAlphaColor(theme.colors.text, 0.55)}>{place}</CaptionText>
						) : null}
					</View>
				</CardSurface>
			) : null}
			{hasFailed ? null : (
				<CaptionText color={toAlphaColor(theme.colors.text, 0.55)} style={styles.sub}>
					{t('liveJoiningSub')}
				</CaptionText>
			)}
			<Pressable accessibilityRole='button' onPress={() => navigation.goBack()} style={styles.cancel}>
				<Typography color={toAlphaColor(theme.colors.text, 0.55)} style={styles.cancelLabel} weight='semibold'>
					{t('cancel')}
				</Typography>
			</Pressable>
		</SafeAreaView>
	);
};

/* The design's measures (Birlikte oku, C2). */
const styles = StyleSheet.create({
	cancel: {
		padding: 8
	},
	cancelLabel: {
		fontSize: 13
	},
	card: {
		alignItems: 'center',
		alignSelf: 'stretch',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	cardCopy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	cardName: {
		fontSize: 14
	},
	screen: {
		alignItems: 'center',
		flex: 1,
		gap: 18,
		justifyContent: 'center',
		paddingBottom: 60,
		paddingHorizontal: 32
	},
	sub: {
		fontSize: 13,
		lineHeight: 20,
		textAlign: 'center'
	},
	title: {
		fontSize: 26,
		lineHeight: 30,
		textAlign: 'center'
	}
});
