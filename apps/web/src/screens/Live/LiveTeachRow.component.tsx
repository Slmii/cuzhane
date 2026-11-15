import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { type LiveMarkStore, useLiveMark } from '@/lib/hooks/useLiveSession';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { hasSeenLiveTeach, markLiveTeachSeen } from '@/lib/utils/liveTeachSeen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { store: LiveMarkStore };

/** How long "Herkes bu satırı görüyor." stays before the row goes (R4). */
const DONE_MS = 2500;

type Phase = 'checking' | 'show' | 'done' | 'gone';

/**
 * "Göster"'s hint for the reader, right under the live row (Birlikte oku v2, R3–R4): "tap the line
 * you're reading so followers can see where you are". **Only in the first reading together** on
 * this phone — "Tamam" or the first tap closes it, and it never comes back. The first tap turns it
 * into the confirmation, "everyone sees this line", which goes after 2.5 s.
 */
export const LiveTeachRow = ({ store }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [phase, setPhase] = useState<Phase>('checking');
	const { isFresh, mark } = useLiveMark(store);

	useEffect(() => {
		let isCancelled = false;

		void hasSeenLiveTeach().then(isSeen => {
			if (!isCancelled) {
				setPhase(isSeen ? 'gone' : 'show');
			}
		});

		return () => {
			isCancelled = true;
		};
	}, []);

	// The reader's first tap answers the hint — worked out while rendering, from the line itself.
	if (phase === 'show' && isFresh && mark !== null) {
		setPhase('done');
	}

	useEffect(() => {
		if (phase !== 'done') {
			return undefined;
		}

		void markLiveTeachSeen();
		const timer = setTimeout(() => setPhase('gone'), DONE_MS);

		return () => clearTimeout(timer);
	}, [phase]);

	if (phase === 'gone') {
		return null;
	}

	const isDone = phase === 'done';
	// Drawn unseen while the phone is asked whether the hint was seen, so "Tamam" — a native button —
	// is already in place when the row shows rather than made on the spot.
	const isChecking = phase === 'checking';

	return (
		<View
			pointerEvents={isChecking ? 'none' : 'auto'}
			style={[
				styles.row,
				{ backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.divider },
				isChecking ? styles.checking : null
			]}
		>
			<View style={[styles.well, { backgroundColor: theme.colors.accentSoft }]}>
				{isDone ? (
					<Icon color={theme.colors.accent} name='check' size={16} strokeWidth={2} />
				) : (
					<Icon color={theme.colors.accent} name='pointLine' size={18} strokeWidth={1.8} />
				)}
			</View>
			<Typography style={styles.text} weight='medium'>
				{isDone ? t('liveTeachDone') : t('liveTeach')}
			</Typography>
			{isDone ? null : (
				<AppButton
					fullWidth={false}
					onPress={() => {
						void markLiveTeachSeen();
						setPhase('gone');
					}}
					size='sm'
					title={t('liveTeachOk')}
					variant='surface'
				/>
			)}
		</View>
	);
};

/* The design's measures (Birlikte oku v2, R3). */
const styles = StyleSheet.create({
	// Out of the column and unseen until the answer comes.
	checking: {
		left: 0,
		opacity: 0,
		position: 'absolute',
		right: 0
	},
	row: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 11,
		minHeight: 56,
		paddingBottom: 9,
		paddingLeft: 18,
		paddingRight: 14,
		paddingTop: 9
	},
	text: {
		flex: 1,
		fontSize: 13,
		lineHeight: 18
	},
	well: {
		alignItems: 'center',
		borderRadius: 10,
		height: 30,
		justifyContent: 'center',
		width: 30
	}
});
