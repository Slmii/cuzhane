import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, MonoText, Typography } from '@/components/ui/Typography/Typography.component';
import { WrapperApiError } from '@/api/wrapper.api';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { AppLanguage } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ErrorStateProps } from './ErrorState.types';

const RING_SIZE = 60;
const RING_ICON_SIZE = 26;

const TIME_LOCALES: Record<AppLanguage, string> = {
	en: 'en-GB',
	nl: 'nl-NL',
	tr: 'tr-TR'
};

/**
 * Frame 2a — the full-page failure, "Ortalanmış · tam sayfa". The design's brief for it is
 * in the section title: *instead of an empty black screen*. A query that fails used to leave
 * a bare `EmptyState` line where the content should be; this takes the whole screen and says
 * three things in order — what happened, that nothing of theirs is lost, and what to do.
 *
 * It is the whole screen, container included, so a screen's error branch is one line:
 * `return <ErrorState queries={[groupQuery, babsQuery]} />`. "Tekrar dene" refetches every
 * query handed in and spins while any of them is in flight. The frame's "Çevrimdışı devam et"
 * link was built and then dropped on request — the page offers one action. The footer's
 * status code and the time the failure was seen are what someone reads back to us when they
 * write in.
 */
export const ErrorState = ({ queries }: ErrorStateProps) => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	// The time the screen failed, not the time it is being looked at — a footer that keeps
	// ticking would suggest the request is still being made.
	const [failedAt] = useState(() => new Date());

	const error = queries.find(query => query.error !== null && query.error !== undefined)?.error;
	const code = error instanceof WrapperApiError ? error.status : null;
	const isRetrying = queries.some(query => query.isFetching);
	const retry = () => queries.forEach(query => void query.refetch());
	const time = failedAt.toLocaleTimeString(TIME_LOCALES[language], { hour: '2-digit', minute: '2-digit' });
	const faint = toAlphaColor(theme.colors.text, 0.5);

	return (
		<ScreenContainer contentContainerStyle={styles.page} isScrollable={false}>
			<View style={styles.body}>
				<View style={[styles.ring, { borderColor: toAlphaColor(theme.colors.text, 0.14) }]}>
					<Icon
						color={toAlphaColor(theme.colors.text, 0.4)}
						name='alertCircle'
						size={RING_ICON_SIZE}
						strokeWidth={1.5}
					/>
				</View>
				<Typography style={styles.title} textAlign='center' variant='header2'>
					{t('errStateTitle')}
				</Typography>
				<CaptionText color={faint} style={styles.description} textAlign='center'>
					{t('errStateBody')}
				</CaptionText>
				<AppButton fullWidth={false} isLoading={isRetrying} onPress={retry} title={t('retry')} />
			</View>
			<MonoText color={toAlphaColor(theme.colors.text, 0.26)} style={styles.footer} textAlign='center'>
				{code === null ? time : t('errStateFoot', { code, time })}
			</MonoText>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	body: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
		paddingBottom: 40,
		paddingHorizontal: 34
	},
	description: {
		fontSize: 12.5,
		lineHeight: 21,
		marginBottom: 24,
		maxWidth: 250
	},
	footer: {
		fontSize: 10,
		paddingBottom: 14,
		paddingHorizontal: 20
	},
	// The frame's own padding, not the container's: the body centres on the full width and
	// the footer sits on the bottom edge.
	page: {
		gap: 0,
		paddingHorizontal: 0
	},
	ring: {
		alignItems: 'center',
		borderRadius: RING_SIZE / 2,
		borderWidth: 1,
		height: RING_SIZE,
		justifyContent: 'center',
		marginBottom: 20,
		width: RING_SIZE
	},
	title: {
		fontSize: 24,
		lineHeight: 31,
		marginBottom: 9
	}
});
